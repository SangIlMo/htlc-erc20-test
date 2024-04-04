import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as fs from "fs";

const config: HardhatUserConfig = {
  networks: {
    hardhat: {
      gas: 30000000,
      allowUnlimitedContractSize: true,
    },
  },
  solidity: "0.8.24",
};

export default config;
