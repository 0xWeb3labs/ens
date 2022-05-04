const hre = require("hardhat");
const ethers = hre.ethers;
const Web3 = require('web3');
const deployDNSSEC = require("./deployDNSSEC");
const { loadContract } = require("./utils");

const dnssec = true;

async function main() {
	hre.Web3 = Web3;
	hre.web3 = new Web3(hre.network.provider);
	const web3 = hre.web3;

	const signers = await ethers.getSigners();
	const accounts = signers.map(s => s.address);

	const resolverJSON = loadContract('resolvers', 'PublicResolver')
	const ENSWithFallbackJSON = loadContract('registry', 'ENSRegistryWithFallback')

	const newEns = new web3.eth.Contract(ENSWithFallbackJSON.abi, "0xb9930eF91BADBC650269c382E3B5877574e6a7fc");
	const newResolver = new web3.eth.Contract(resolverJSON.abi, "0xbf4296d057Db7c93529e47B510B9F09F0A5B0a52")

	if (dnssec) {
		await deployDNSSEC(web3, accounts, newEns, newResolver)
	}
};

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});