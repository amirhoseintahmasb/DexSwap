import { Contract, ContractFactory, BigNumberish, ethers, utils } from "ethers";
import { BigNumber } from "bignumber.js";
import token from "./../artifacts/contracts/token.sol/Token.json";
import UniswapV3Pool from "@uniswap/v3-core/artifacts/contracts/UniswapV3Pool.sol/UniswapV3Pool.json";
import { nearestUsableTick, Pool, Position } from "@uniswap/v3-sdk";
import { Token } from "@uniswap/sdk-core";
import fs from "fs";
import * as dotenv from "dotenv";

dotenv.config();

type ContractJson = { abi: any; bytecode: string };
const artifacts: { [name: string]: ContractJson } = {
  UniswapV3Factory: require("@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json"),
  SwapRouter: require("@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json"),
  NFTDescriptor: require("@uniswap/v3-periphery/artifacts/contracts/libraries/NFTDescriptor.sol/NFTDescriptor.json"),
  NonfungibleTokenPositionDescriptor: require("@uniswap/v3-periphery/artifacts/contracts/NonfungibleTokenPositionDescriptor.sol/NonfungibleTokenPositionDescriptor.json"),
  NonfungiblePositionManager: require("@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json"),
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

BigNumber.config({ EXPONENTIAL_AT: 999999, DECIMAL_PLACES: 40 });

let chainId = process.env.CHAINID ? parseInt(process.env.CHAINID) : 1;
let provider = new ethers.providers.JsonRpcProvider(process.env.PROVIDER);

let owner = new ethers.Wallet(
  process.env.OWNER ? process.env.OWNER : "",
  provider
);

let signer = new ethers.Wallet(
  process.env.SIGNER ? process.env.SIGNER : "",
  provider
);

function encodePriceSqrt(
  reserve0: BigNumberish,
  reserve1: BigNumberish
): BigNumberish {
  return new BigNumber(reserve1.toString())
    .div(reserve0.toString())
    .sqrt()
    .multipliedBy(new BigNumber(2).pow(96))
    .integerValue(3)
    .toString();
}

const linkLibraries = (
  {
    bytecode,
    linkReferences,
  }: {
    bytecode: string;
    linkReferences: {
      [fileName: string]: {
        [contractName: string]: { length: number; start: number }[];
      };
    };
  },
  libraries: { [libraryName: string]: string }
): string => {
  Object.keys(linkReferences).forEach((fileName) => {
    Object.keys(linkReferences[fileName]).forEach((contractName) => {
      if (!libraries.hasOwnProperty(contractName)) {
        throw new Error(`Missing link library name ${contractName}`);
      }
      const address = utils
        .getAddress(libraries[contractName])
        .toLowerCase()
        .slice(2);
      linkReferences[fileName][contractName].forEach(
        ({ start: byteStart, length: byteLength }) => {
          const start = 2 + byteStart * 2;
          const length = byteLength * 2;
          bytecode = bytecode
            .slice(0, start)
            .concat(address)
            .concat(bytecode.slice(start + length, bytecode.length));
        }
      );
    });
  });
  return bytecode;
};

async function deployUniswapV3Contracts(weth: string) {
  let Factory = new ContractFactory(
    artifacts.UniswapV3Factory.abi,
    artifacts.UniswapV3Factory.bytecode,
    owner
  );
  let factory = await Factory.deploy();
  console.log("uniswapV3 factory contract address : ", factory.address);

  let SwapRouter = new ContractFactory(
    artifacts.SwapRouter.abi,
    artifacts.SwapRouter.bytecode,
    owner
  );
  let swapRouter = await SwapRouter.deploy(factory.address, weth);
  console.log("swap router contract address : ", swapRouter.address);

  let NFTDescriptor = new ContractFactory(
    artifacts.NFTDescriptor.abi,
    artifacts.NFTDescriptor.bytecode,
    owner
  );
  let nftDescriptor = await NFTDescriptor.deploy();
  console.log("nft descriptor contract address : ", nftDescriptor.address);

  const linkedBytecode = linkLibraries(
    {
      bytecode: artifacts.NonfungibleTokenPositionDescriptor.bytecode,
      linkReferences: {
        "NFTDescriptor.sol": {
          NFTDescriptor: [
            {
              length: 20,
              start: 1261,
            },
          ],
        },
      },
    },
    {
      NFTDescriptor: nftDescriptor.address,
    }
  );

  let NonfungibleTokenPositionDescriptor = new ContractFactory(
    artifacts.NonfungibleTokenPositionDescriptor.abi,
    linkedBytecode,
    owner
  );
  let nonfungibleTokenPositionDescriptor =
    await NonfungibleTokenPositionDescriptor.deploy(weth);
  console.log(
    "nonfungible token position descriptor contract address : ",
    nonfungibleTokenPositionDescriptor.address
  );

  let NonfungiblePositionManager = new ContractFactory(
    artifacts.NonfungiblePositionManager.abi,
    artifacts.NonfungiblePositionManager.bytecode,
    owner
  );

  let nonfungiblePositionManager = await NonfungiblePositionManager.deploy(
    factory.address,
    weth,
    nonfungibleTokenPositionDescriptor.address
  );
  console.log(
    "nonfungible position manager contract address : ",
    nonfungiblePositionManager.address
  );

  const filename = "data.json";

  let data: any = {};

  // Check if the file exists
  if (fs.existsSync(filename)) {
    const fileContents = fs.readFileSync(filename, "utf-8");
    data = JSON.parse(fileContents);
  }

  data["uniswapV3"] = {
    factory: factory.address,
    swapRouter: swapRouter.address,
    nftDescriptor: nftDescriptor.address,
    nonfungibleTokenPositionDescriptor:
      nonfungibleTokenPositionDescriptor.address,
    nonfungiblePositionManager: nonfungiblePositionManager.address,
    pools: {},
  };

  fs.writeFileSync(filename, JSON.stringify(data, null, 2));
}

async function deployUniswapV3Pool(
  token0symbol: string,
  token1symbol: string,
  token0: string,
  token1: string,
  fee: number,
  reserve0: BigNumberish,
  reserve1: BigNumberish
  //   sqrtPrice: string
): Promise<string> {
  const nonfungiblePositionManager = new Contract(
    require("../data.json")["uniswapV3"]["nonfungiblePositionManager"],
    artifacts.NonfungiblePositionManager.abi,
    owner
  );

  const factory = new Contract(
    require("../data.json")["uniswapV3"]["factory"],
    artifacts.UniswapV3Factory.abi,
    owner
  );

  const sqrtPrice = encodePriceSqrt(reserve0, reserve1);

  let createPool = await nonfungiblePositionManager
    .connect(owner)
    .createAndInitializePoolIfNecessary(token0, token1, fee, sqrtPrice, {
      gasLimit: 5000000,
    });

  await createPool.wait();

  const address = await factory.connect(owner).getPool(token0, token1, fee);

  const filename = "data.json";

  let data: any = {};

  // Check if the file exists
  if (fs.existsSync(filename)) {
    const fileContents = fs.readFileSync(filename, "utf-8");
    data = JSON.parse(fileContents);
  }

  data["uniswapV3"]["pools"][`${token0symbol}_${token1symbol}`] = {
    address,
    token0,
    token1,
    fee,
  };

  fs.writeFileSync(filename, JSON.stringify(data, null, 2));

  return address;
}

async function addLiquidityToPool(
  address: string,
  token0: string,
  token1: string,
  amountToken0: string,
  amountToken1: string
) {
  // TODO: add liquidity to created pool
  const token0Contract = new Contract(token0, token.abi, owner);
  const token1Contract = new Contract(token1, token.abi, owner);

  const nonfungiblePositionManager = new Contract(
    require("../data.json")["uniswapV3"]["nonfungiblePositionManager"],
    artifacts.NonfungiblePositionManager.abi,
    owner
  );

  await token0Contract
    .connect(owner)
    .approve(nonfungiblePositionManager.address, amountToken0);
  await token1Contract
    .connect(owner)
    .approve(nonfungiblePositionManager.address, amountToken1);

  const poolContract = new Contract(address, UniswapV3Pool.abi, owner);

  const [tickSpacing, fee, liquidity, slot0] = await Promise.all([
    poolContract.tickSpacing(),
    poolContract.fee(),
    poolContract.liquidity(),
    poolContract.slot0(),
  ]);

  let sqrtPriceX96 = slot0[0];
  let tick = slot0[1];

  const pool = new Pool(
    new Token(
      chainId,
      token0Contract.address,
      await token0Contract.connect(owner).decimals(),
      await token0Contract.connect(owner).symbol(),
      await token0Contract.connect(owner).name()
    ),
    new Token(
      chainId,
      token1Contract.address,
      await token1Contract.connect(owner).decimals(),
      await token1Contract.connect(owner).symbol(),
      await token1Contract.connect(owner).name()
    ),
    fee,
    sqrtPriceX96.toString(),
    liquidity.toString(),
    tick
  );

  //   const position = new Position({
  //     pool: pool,
  //     liquidity: 1,
  //     tickLower: nearestUsableTick(tick, tickSpacing) - tickSpacing * 2,
  //     tickUpper: nearestUsableTick(tick, tickSpacing) + tickSpacing * 2,
  //   });

  const position = Position.fromAmounts({
    pool,
    tickLower: nearestUsableTick(tick, tickSpacing) - tickSpacing * 2,
    tickUpper: nearestUsableTick(tick, tickSpacing) + tickSpacing * 2,
    amount0: amountToken0,
    amount1: amountToken1,
    useFullPrecision: true,
  });

  const { amount0: amount0Desired, amount1: amount1Desired } =
    position.mintAmounts;

  let params = {
    token0,
    token1,
    fee: fee,
    tickLower: position.tickLower,
    tickUpper: position.tickUpper,
    amount0Desired: amount0Desired.toString(),
    amount1Desired: amount1Desired.toString(),
    amount0Min: 0,
    amount1Min: 0,
    recipient: owner.address,
    deadline: Math.floor(Date.now() / 1000) + 60 * 10,
  };

  const tx = await nonfungiblePositionManager
    .connect(owner)
    .mint(params, { gasLimit: "5000000" });

  const receipt = await tx.wait();

  // console.log(receipt);
}

async function main() {
  // await deployUniswapV3Contracts(require("../data.json").tokens.WETH);


  let pool_fee = 500;
  let reserve0 = "99195828637064";
  let reserve1 = "99195828637061";

  // let pool_USDT_USDC = await deployUniswapV3Pool(
  //   "USDT",
  //   "USDC",
  //   require("../data.json").tokens.USDT,
  //   require("../data.json").tokens.USDC,
  //   pool_fee,
  //   reserve0,
  //   reserve1
  // );

  // await addLiquidityToPool(
  //   pool_USDT_USDC,
  //   require("../data.json").tokens.USDT,
  //   require("../data.json").tokens.USDC,
  //   "10000000000",
  //   "10000000000"
  // );
  
  // console.log(`pool(USDT_USDC) deployed. address :`, pool_USDT_USDC);

  // let pool_DAI_USDC = await deployUniswapV3Pool(
  //   "DAI",
  //   "USDC",
  //   require("../data.json").tokens.DAI,
  //   require("../data.json").tokens.USDC,
  //   pool_fee,
  //   reserve0,
  //   reserve1
  // );

  // await addLiquidityToPool(
  //   // pool_DAI_USDC,
  //   require("../data.json").tokens.DAI,
  //   require("../data.json").tokens.USDC,
  //   "10000000000",
  //   "10000000000"
  // );

  // console.log(`pool(USDC/DAI_USDC) deployed. address :`, pool_DAI_USDC);

}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
