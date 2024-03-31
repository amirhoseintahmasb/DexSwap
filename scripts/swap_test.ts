import { Contract, ContractFactory, BigNumberish, ethers, utils } from "ethers";
import token from "./../artifacts/contracts/token.sol/Token.json";
import * as dotenv from "dotenv";
import { nearestUsableTick, Pool, Position } from "@uniswap/v3-sdk";
import { Token } from "@uniswap/sdk-core";
import UniswapV3Pool from "@uniswap/v3-core/artifacts/contracts/UniswapV3Pool.sol/UniswapV3Pool.json";
import fs from "fs";

type ContractJson = { abi: any; bytecode: string };
const artifacts: { [name: string]: ContractJson } = {
  UniswapV3Factory: require("@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json"),
  SwapRouter: require("@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json"),
  NFTDescriptor: require("@uniswap/v3-periphery/artifacts/contracts/libraries/NFTDescriptor.sol/NFTDescriptor.json"),
  NonfungibleTokenPositionDescriptor: require("@uniswap/v3-periphery/artifacts/contracts/NonfungibleTokenPositionDescriptor.sol/NonfungibleTokenPositionDescriptor.json"),
  NonfungiblePositionManager: require("@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json"),
};
dotenv.config();
let chainId = process.env.CHAINID ? parseInt(process.env.CHAINID) : 1;
let provider = new ethers.providers.JsonRpcProvider(process.env.PROVIDER);

let owner = new ethers.Wallet(
    process.env.OWNER ? process.env.OWNER : "",
    provider
);

const filename = "data.json";

let data: any = {};

// Check if the file exists
if (fs.existsSync(filename)) {
    const fileContents = fs.readFileSync(filename, "utf-8");
    data = JSON.parse(fileContents);
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
    
    let pool_fee = 500;
    let reserve0 = "99195828637064";
    let reserve1 = "99195828637061";
    const router = new ethers.Contract(
        
       
        // TODO: Dynamic from json file read: Uniswap V3 Router address 
        data["uniswapV3"].swapRouter.address,
        // ABI for the Uniswap V3 Router
        require("@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json").abi,
        owner
    );

    console.log(router.address)

    //create pool and then add liquidity
    let pool_USDT_USDC = data["uniswapV3"].pool_DAI_USDC.address

    await addLiquidityToPool(
        pool_USDT_USDC,
        require("../data.json").tokens.DAI,
        require("../data.json").tokens.USDC,
        "10000000000",
        "10000000000"
    );

    //TODO: old and change to add swap!!
    const params = {
        tokenIn: require("../data.json").tokens.DAI,
        tokenOut: require("../data.json").tokens.USDC,
        fee: 500,
        recipient: "0x953EF320B3A7F05c41271cA3B499ecD99745342E",
        deadline: Math.floor(Date.now() / 1000) + 60 * 20, // 20 minutes from the current Unix time
        amountIn: 10*10^18,
        amountOutMinimum: 0, // Set to 0 for simplicity; in practice, calculate based on acceptable slippage
        sqrtPriceLimitX96: 0 // Set to 0 to allow any price movement
    };

    const tx = await router.exactInputSingle(params, {
        gasLimit: "1000000", // Set an appropriate gas limit
    });

    console.log(`Transaction hash: ${tx.hash}`);

    const receipt = await tx.wait();
    console.log(`Transaction was mined in block ${receipt.blockNumber}`);
}


main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
