import { ContractFactory, BaseContract, ethers } from "ethers";
import token from "./../artifacts/contracts/token.sol/Token.json";
import * as dotenv from "dotenv";
import fs from "fs";

dotenv.config();

type ContractJson = { abi: any; bytecode: string };
const artifacts: { [name: string]: ContractJson } = {
  WETH9: require("../WETH9.json"),
};

let provider = new ethers.providers.JsonRpcProvider(process.env.PROVIDER);

let owner = new ethers.Wallet(
  process.env.OWNER ? process.env.OWNER : "",
  provider
);

let signer = new ethers.Wallet(
  process.env.SIGNER ? process.env.SIGNER : "",
  provider
);

async function deployWETH() {
  let Weth = new ContractFactory(
    artifacts.WETH9.abi,
    artifacts.WETH9.bytecode,
    owner
  );
  let weth: BaseContract = await Weth.deploy();
  console.log("Weth contract address : ", weth.address);

  const filename = "data.json";

  let data: any = {};

  // Check if the file exists
  if (fs.existsSync(filename)) {
    const fileContents = fs.readFileSync(filename, "utf-8");
    data = JSON.parse(fileContents);
  }

  data["tokens"]["WETH"] = weth.address;

  fs.writeFileSync(filename, JSON.stringify(data, null, 2));
}

async function deployTokens(
  name: string,
  symbol: string,
  amount: string,
  decimals: number
) {
  let ERC20 = new ContractFactory(token.abi, token.bytecode, owner);

  let tokenContract: BaseContract = await ERC20.deploy(
    name,
    symbol,
    amount,
    decimals,
    {
      gasLimit: 5000000,
    }
  );
  console.log(`Token ${name} contract address : `, tokenContract.address);

  const filename = "data.json";

  let data: any = {};

  // Check if the file exists
  if (fs.existsSync(filename)) {
    const fileContents = fs.readFileSync(filename, "utf-8");
    data = JSON.parse(fileContents);
  }

  data["tokens"][symbol] = tokenContract.address;

  fs.writeFileSync(filename, JSON.stringify(data, null, 2));
}

async function main() {
  await deployWETH();

  await deployTokens("Tether USD", "USDT", "10000000000000000", 6);

  await deployTokens("USD Coin", "USDC", "10000000000000000", 6);

  await deployTokens(
    "Dai Stablecoin",
    "DAI",
    "10000000000000000000000000000",
    18
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
