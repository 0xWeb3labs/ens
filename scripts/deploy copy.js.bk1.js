const hre = require("hardhat");
const namehash = require('eth-ens-namehash');
const tld = "eth";
const ethers = hre.ethers;
const utils = ethers.utils;
const labelhash = (label) => utils.keccak256(utils.toUtf8Bytes(label))
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const ROOT_NODE = '0x00000000000000000000000000000000';
const ZERO_HASH = "0x0000000000000000000000000000000000000000000000000000000000000000";
const Web3 = require('web3');
const web3 = new Web3("http://localhost:8545");
const tld_hash = namehash.hash(tld);

function loadContract(modName, contractPath) {
  let loadpath
  const contractName = contractPath.split('/').reverse()[0]
  if (['ens-022', 'ethregistrar-202', 'subdomain-registrar'].includes(modName)) {
    loadpath = `${process.env.PWD}/node_modules/@ensdomains/ens-archived-contracts/abis/${modName}/${contractName}.json`
  } else {
    loadpath = `${process.env.PWD}/node_modules/@ensdomains/ens-contracts/artifacts/contracts/${modName}/${contractPath}.sol/${contractName}.json`
  }
  return require(loadpath)
}

function deploy(web3, account, contractJSON, ...args) {
  const contract = new web3.eth.Contract(contractJSON.abi)
  return contract
    .deploy({
      data: contractJSON.bytecode,
      arguments: args,
    })
    .send({
      from: account,
      gas: 6700000,
    })
}

async function main() {
  // emptyAddress: '0x0000000000000000000000000000000000000000',
  //   ownerAddress: accounts[0],
  //   bulkRenewalAddress: bulkRenewal._address,
  //   legacyAuctionRegistrarAddress: legacyAuctionRegistrar._address,
  //   oldEnsAddress: ens._address,
  //   oldContentResolverAddresses: [oldResolver._address],
  //   oldResolverAddresses: [resolver._address, oldResolver._address],
  //   oldControllerAddress: controller._address,
  //   oldBaseRegistrarAddress: oldBaseRegistrar._address,
  //   reverseRegistrarAddress: oldReverseRegistrar._address,
  //   ensAddress: newEns._address,
  //   registrarMigration: registrarMigration && registrarMigration._address,
  //   resolverAddress: newResolver._address,
  //   reverseRegistrarAddress:
  //     newReverseRegistrar && newReverseRegistrar._address,
  //   reverseRegistrarOwnerAddress: accounts[0],
  //   controllerAddress: newController._address,
  //   baseRegistrarAddress: newBaseRegistrar._address,
  //   exponentialPremiumPriceOracle: exponentialPremiumPriceOracle._address,
  //   dummyOracle: dummyOracle._address,
  const signers = await ethers.getSigners();
  const accounts = signers.map(s => s.address);
  console.log("accounts =", accounts);

  const ENSRegistry = await ethers.getContractFactory("ENSRegistry");
  const oldEns = await ENSRegistry.deploy();
  oldEns.deployed();
  console.log("oldEns:", oldEns.address);

  const oldResolverJSON = loadContract('ens-022', 'PublicResolver');
  /////////////////////

  const ENSRegistryWithFallback = await ethers.getContractFactory("ENSRegistryWithFallback");
  const newEns = await ENSRegistryWithFallback.deploy(oldEns.address);
  await newEns.deployed();
  console.log("newEns:", newEns.address);

  const BulkRenewal = await ethers.getContractFactory("BulkRenewal");
  const bulkRenewal = await BulkRenewal.deploy(newEns.address);
  await bulkRenewal.deployed();
  console.log("bulkRenewal:", bulkRenewal.address);

  const PublicResolver = await ethers.getContractFactory("PublicResolver")
  const newResolver = await PublicResolver.deploy(newEns.address, ZERO_ADDRESS);
  await newResolver.deployed()
  console.log("newResolver:", newResolver.address);

  await newResolver.setInterface(tld_hash, '0x3150bfba', bulkRenewal.address, { gasLimit: 210000 });

  const eightweeks = (60 * 60 * 24 * 7 * 8)
  const startTime = (await web3.eth.getBlock('latest')).timestamp - eightweeks
  const legacyAuctionRegistrarSimplifiedJSON = loadContract('ens-022', 'HashRegistrar');
  const legacyAuctionRegistrar = await deploy(web3, accounts[0], legacyAuctionRegistrarSimplifiedJSON, oldEns.address, tld_hash, startTime);
  console.log("legacyAuctionRegistrar:", legacyAuctionRegistrar._address);

  await oldEns.setSubnodeOwner(ROOT_NODE, web3.utils.sha3(tld), legacyAuctionRegistrar._address, { gasLimit: 210000 });

  // namehash('ela'),
  //       legacyRegistrarInterfaceId,
  //       legacyAuctionRegistrar._address
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });