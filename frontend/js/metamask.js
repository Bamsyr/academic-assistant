const API_BASE = "http://localhost:3001/api";

const MetaMask = {
  account: null,
  role: null,
  group: null,

  async connect() {
    if (!window.ethereum) {
      alert("MetaMask is not installed. Please install it from metamask.io");
      return false;
    }
    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      this.account = accounts[0];
      await this._loadRoleAndGroup();
      return true;
    } catch (err) {
      console.error("MetaMask connect error:", err);
      return false;
    }
  },

  async _loadRoleAndGroup() {
    const res = await fetch(`${API_BASE}/roles/${this.account}`);
    const data = await res.json();
    this.role  = data.role;
    this.group = data.group;
  },

  // Build calldata and send TX via MetaMask
  // abi: array of ABI items, functionName: string, args: array
  async sendContractTx(contractAddress, abi, functionName, args) {
    // Use viem loaded via CDN to encode calldata
    const calldata = window.viem.encodeFunctionData({ abi, functionName, inputs: args });
    const txHash = await window.ethereum.request({
      method: "eth_sendTransaction",
      params: [{ from: this.account, to: contractAddress, data: calldata }],
    });
    return txHash;
  },

  onAccountChange(callback) {
    window.ethereum.on("accountsChanged", async (accounts) => {
      this.account = accounts[0] ?? null;
      if (this.account) await this._loadRoleAndGroup();
      callback(this.account);
    });
  },

  shortAddress() {
    if (!this.account) return "";
    return `${this.account.slice(0, 6)}...${this.account.slice(-4)}`;
  },
};
