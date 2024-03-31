import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: {
        enabled: true,
        runs: 1000,
      },
      viaIR: true,
    },
  },
  defaultNetwork: "ganache",
  networks: {
    ganache: {
      chainId: 5777,
      url: "http://127.0.0.1:7545",
      accounts: [
        "0xf086195698520cd30bb738efc675d89e862e7dbdbaf88878bf6f6961f94e1563",
        "0x33bb397181ce0065dacebeec60ede3729b0e667c4c0d818e618621a0c364debf",
      ],
    },
  },
};

export default config;
