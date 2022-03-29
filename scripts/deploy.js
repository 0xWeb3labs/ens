const hre = require("hardhat");
const namehash = require('eth-ens-namehash');
const web3Utils = require('web3-utils')
const tld = "ela";
const ethers = hre.ethers;
const utils = ethers.utils;
const labelhash = (label) => utils.keccak256(utils.toUtf8Bytes(label))
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const ZERO_HASH = "0x0000000000000000000000000000000000000000000000000000000000000000";
async function main() {
  const tld_hash = namehash.hash(tld);

  const ENSRegistryWithFallback = await ethers.getContractFactory("ENSRegistryWithFallback")
  const ENSRegistry = await ethers.getContractFactory("ENSRegistry")
  const FIFSRegistrar = await ethers.getContractFactory("FIFSRegistrar")
  const ReverseRegistrar = await ethers.getContractFactory("ReverseRegistrar")
  const PublicResolver = await ethers.getContractFactory("PublicResolver")
  const ETHRegistrarController = await ethers.getContractFactory("ETHRegistrarController");
  const BaseRegistrarImplementation = await ethers.getContractFactory("BaseRegistrarImplementation");
  const DummyOracle = await ethers.getContractFactory("DummyOracle");
  const StablePriceOracle = await ethers.getContractFactory("StablePriceOracle");
  const Root = await ethers.getContractFactory("Root");
  const DNSRegistrar = await ethers.getContractFactory("DNSRegistrar");
  const SimplePublicSuffixList = await ethers.getContractFactory("SimplePublicSuffixList");
  const DummyDNSSEC = await ethers.getContractFactory("DummyDNSSEC"); // in DummyDnsRegistrarDNSSEC.sol

  const signers = await ethers.getSigners();
  const accounts = signers.map(s => s.address);

  const ens_old = await ENSRegistry.deploy();
  await ens_old.deployed();
  console.log("ens_old:", ens_old.address);

  const ens = await ENSRegistryWithFallback.deploy(ens_old.address);
  await ens.deployed();
  console.log("ens:", ens.address);

  const resolver = await PublicResolver.deploy(ens_old.address, ZERO_ADDRESS);
  await resolver.deployed();
  console.log("resolver:", resolver.address);
  await setupResolver(ens_old, resolver, accounts);

  // const registrar = await FIFSRegistrar.deploy(ens_old.address, tld_hash);
  // await registrar.deployed();
  // console.log("tld registrar:", registrar.address);
  // await setupRegistrar(ens_old, registrar);

  // const reverseRegistrar = await ReverseRegistrar.deploy(ens_old.address, resolver.address);
  // await reverseRegistrar.deployed()
  // console.log("reverseRegistrar:", reverseRegistrar.address);
  // await setupReverseRegistrar(ens_old, registrar, reverseRegistrar, accounts);

  const baseRegistrar = await BaseRegistrarImplementation.deploy(ens_old.address, tld_hash);
  await baseRegistrar.deployed();
  console.log("baseRegistrar:", baseRegistrar.address);
  await setupRegistrar(ens_old, baseRegistrar);
  const gracePeriod = await baseRegistrar.GRACE_PERIOD();
  console.log("-- gracePeriod:", gracePeriod);
  const baseRegistrarAvailable = await baseRegistrar.available(labelhash("new_domain"));
  console.log("-- available:", baseRegistrarAvailable);

  const reverseRegistrar = await ReverseRegistrar.deploy(ens_old.address, resolver.address);
  await reverseRegistrar.deployed()
  console.log("reverseRegistrar:", reverseRegistrar.address);
  await setupReverseRegistrar(ens_old, baseRegistrar, reverseRegistrar, accounts);

  const dummyOracle = await DummyOracle.deploy("100000000");
  await dummyOracle.deployed();

  const stablePriceOracle = await StablePriceOracle.deploy(dummyOracle.address, [0, 0, 4, 2, 1]);
  await stablePriceOracle.deployed();

  const controller = await ETHRegistrarController.deploy(baseRegistrar.address, stablePriceOracle.address, 600, 86400); // reverseRegistrar.address,ZERO_ADDRESS
  await controller.deployed();
  console.log("controller:", controller.address);
  const available = await controller.available("new_domain");
  console.log("-- available:", available);

  await baseRegistrar.addController(controller.address, { gasLimit: 210000 });
  await baseRegistrar.addController(accounts[0], { gasLimit: 210000 });

  await resolver.setInterface(tld_hash, '0x018fac06', controller.address, { gasLimit: 210000 });

  const root = await Root.deploy(ens_old.address);
  await root.deployed();
  console.log("root:", root.address);

  const dummyDNSSEC = await DummyDNSSEC.deploy();
  await dummyDNSSEC.deployed();

  const simplePublicSuffixList = await SimplePublicSuffixList.deploy();
  await simplePublicSuffixList.deployed();
  // await suffixes.addPublicSuffixes()

  const dnsRegistrar = await DNSRegistrar.deploy(dummyDNSSEC.address, simplePublicSuffixList.address, ens_old.address);
  await dnsRegistrar.deployed();
  console.log("dnsRegistrar:", dnsRegistrar.address);
  const supportsInterfaceResult = await dnsRegistrar.supportsInterface("0x1aa2e641");
  console.log("-- supportsInterface(0x1aa2e641) result:", supportsInterfaceResult);

  const supportsInterfaceResultNew = await dnsRegistrar.supportsInterface("0x17d8f49b");
  console.log("-- supportsInterface(0x17d8f49b) result:", supportsInterfaceResultNew);

  root.setController(dnsRegistrar.address, true, { gasLimit: 21000 });
};

async function setupResolver(ens, resolver, accounts) {
  const resolverNode = namehash.hash("resolver");
  const resolverLabel = labelhash("resolver");
  await ens.setSubnodeOwner(ZERO_HASH, resolverLabel, accounts[0]);
  await ens.setResolver(resolverNode, resolver.address, { gasLimit: 210000 });
  await resolver['setAddr(bytes32,address)'](resolverNode, resolver.address, { gasLimit: 210000 });
}

async function setupRegistrar(ens, registrar) {
  await ens.setSubnodeOwner(ZERO_HASH, labelhash(tld), registrar.address);
}

async function setupReverseRegistrar(ens, registrar, reverseRegistrar, accounts) {
  await ens.setSubnodeOwner(ZERO_HASH, labelhash("reverse"), accounts[0]);
  await ens.setSubnodeOwner(namehash.hash("reverse"), labelhash("addr"), reverseRegistrar.address, { gasLimit: 210000 });
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });