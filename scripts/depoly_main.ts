import {
  BaseContract,
  BigNumber,
  Contract,
  ContractFactory,
  ethers,
  Event,
} from "ethers";
// import token from "./../artifacts/contracts/token.sol/Token.json";
import * as dotenv from "dotenv";

dotenv.config();

const filename = "main_data.json";
const dataPath = "../main_data.json";

const logname = "main-buy-logs.json";

let chainId = 137;
let chainName = "Polygon";

let provider = new ethers.providers.JsonRpcProvider(process.env.PROVIDER);

let owner = new ethers.Wallet(
  process.env.OWNER ? process.env.OWNER : "",
  provider
);

let addresses = {
  assetsManager: require(dataPath).tesilis.assetManager
    ? require(dataPath).tesilis.assetManager
    : "",
  indexManager: require(dataPath).tesilis.indexManager
    ? require(dataPath).tesilis.indexManager
    : "",
  bank: require(dataPath).tesilis.bank ? require(dataPath).tesilis.bank : "",
  mainController: require(dataPath).tesilis.mainController
    ? require(dataPath).tesilis.mainController
    : "",
  stableIndexToken: require(dataPath).tesilis.stableIndexToken
    ? require(dataPath).tesilis.stableIndexToken
    : "",
};

//////////////////////////////////////// contracts configs ////////////////////////////////////////

async function approveUsdc(amount: string) {
  let USDC = new Contract(
    require(dataPath).tokens.USDC,
    [
      {
        inputs: [
          { internalType: "address", name: "_proxyTo", type: "address" },
        ],
        stateMutability: "nonpayable",
        type: "constructor",
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: false,
            internalType: "address",
            name: "_new",
            type: "address",
          },
          {
            indexed: false,
            internalType: "address",
            name: "_old",
            type: "address",
          },
        ],
        name: "ProxyOwnerUpdate",
        type: "event",
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: "address",
            name: "_new",
            type: "address",
          },
          {
            indexed: true,
            internalType: "address",
            name: "_old",
            type: "address",
          },
        ],
        name: "ProxyUpdated",
        type: "event",
      },
      { stateMutability: "payable", type: "fallback" },
      {
        inputs: [],
        name: "IMPLEMENTATION_SLOT",
        outputs: [{ internalType: "bytes32", name: "", type: "bytes32" }],
        stateMutability: "view",
        type: "function",
      },
      {
        inputs: [],
        name: "OWNER_SLOT",
        outputs: [{ internalType: "bytes32", name: "", type: "bytes32" }],
        stateMutability: "view",
        type: "function",
      },
      {
        inputs: [],
        name: "implementation",
        outputs: [{ internalType: "address", name: "", type: "address" }],
        stateMutability: "view",
        type: "function",
      },
      {
        inputs: [],
        name: "proxyOwner",
        outputs: [{ internalType: "address", name: "", type: "address" }],
        stateMutability: "view",
        type: "function",
      },
      {
        inputs: [],
        name: "proxyType",
        outputs: [
          { internalType: "uint256", name: "proxyTypeId", type: "uint256" },
        ],
        stateMutability: "pure",
        type: "function",
      },
      {
        inputs: [
          { internalType: "address", name: "newOwner", type: "address" },
        ],
        name: "transferProxyOwnership",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
      },
      {
        inputs: [
          { internalType: "address", name: "_newProxyTo", type: "address" },
          { internalType: "bytes", name: "data", type: "bytes" },
        ],
        name: "updateAndCall",
        outputs: [],
        stateMutability: "payable",
        type: "function",
      },
      {
        inputs: [
          { internalType: "address", name: "_newProxyTo", type: "address" },
        ],
        name: "updateImplementation",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
      },
      { stateMutability: "payable", type: "receive" },
    ],
    owner
  );

  let approval = await USDC.connect(owner).approve(
    require(dataPath)["tesilis"]["mainController"],
    amount
  );
  let approvalReceipt = await approval.wait();
  console.log("approval receipt : ", approvalReceipt);

  let allowance = await USDC.connect(owner).allowance(
    owner.address,
    require(dataPath)["tesilis"]["mainController"]
  );
  console.log("allowance check : ", allowance);
}

async function main() {
  console.log(addresses);

  // await deployTesilisAssetManager();

  // await deployTesilisIndexManager();

  // await deployTesilisBank();

  // await deployTesilisMainController();

  // await deployTesilisStableIndexToken("Stablecoin", "TSST", 18);

  // await baseConfig();

  // await approveUsdc("100000000");

  // await buyIndexOfTesilis("10000000");

  // 9990000000000000000
  // 999000000000000000
  // 4995000000000000000
  // 3996000000000000000
  // await sellIndexOfTesilis("3996000000000000000");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
