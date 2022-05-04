pragma solidity >=0.8.4;

interface IPriceOracle {
    //
}

contract WrappedPriceOracle {
    IPriceOracle private _priceOracle;

    constructor(address priceOracle) public {
        _priceOracle = IPriceOracle(priceOracle);
    }
}
