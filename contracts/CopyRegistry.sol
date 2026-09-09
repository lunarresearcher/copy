// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title CopyRegistry
/// @notice Optional non-custodial on-chain registry for COPY wallet watchlists and copy-rule preferences.
/// @dev This contract never holds funds and never executes swaps. Execution remains wallet-signature gated.
contract CopyRegistry {
    struct CopyRule {
        uint96 maxBuyWei;
        uint96 maxMarketCapUsdE6;
        uint96 minLiquidityUsdE6;
        uint16 maxTaxBps;
        uint16 slippageBps;
        uint16 takeProfitBps;
        int16 stopLossBps;
        uint8 minConviction;
        uint8 maxConcurrent;
        bool copyBuys;
        bool copySells;
        bool enabled;
    }

    mapping(address user => mapping(address target => bool)) public isTracked;
    mapping(address user => address[]) private _tracked;
    mapping(address user => mapping(address target => CopyRule)) public copyRules;

    event WalletTracked(address indexed user, address indexed target);
    event WalletUntracked(address indexed user, address indexed target);
    event CopyRuleUpdated(address indexed user, address indexed target, uint96 maxBuyWei, uint8 minConviction, bool enabled);

    error ZeroAddress();

    function trackWallet(address target) external {
        if (target == address(0)) revert ZeroAddress();
        if (isTracked[msg.sender][target]) return;
        isTracked[msg.sender][target] = true;
        _tracked[msg.sender].push(target);
        emit WalletTracked(msg.sender, target);
    }

    function untrackWallet(address target) external {
        if (!isTracked[msg.sender][target]) return;
        isTracked[msg.sender][target] = false;
        emit WalletUntracked(msg.sender, target);
    }

    function setCopyRule(address target, CopyRule calldata rule) external {
        if (target == address(0)) revert ZeroAddress();
        if (!isTracked[msg.sender][target]) {
            isTracked[msg.sender][target] = true;
            _tracked[msg.sender].push(target);
            emit WalletTracked(msg.sender, target);
        }
        copyRules[msg.sender][target] = rule;
        emit CopyRuleUpdated(msg.sender, target, rule.maxBuyWei, rule.minConviction, rule.enabled);
    }

    function trackedWallets(address user) external view returns (address[] memory active) {
        address[] storage all = _tracked[user];
        uint256 count;
        for (uint256 i; i < all.length; ++i) if (isTracked[user][all[i]]) ++count;
        active = new address[](count);
        uint256 j;
        for (uint256 i; i < all.length; ++i) {
            address target = all[i];
            if (isTracked[user][target]) active[j++] = target;
        }
    }
}
