document.addEventListener("DOMContentLoaded", () => {
  const connectBtn   = document.getElementById("connect-btn");
  const walletLabel  = document.getElementById("wallet-label");
  const mainContent  = document.getElementById("main-content");

  // ── Wallet connect ────────────────────────────────────────────────────────
  connectBtn.addEventListener("click", async () => {
    const ok = await MetaMask.connect();
    if (!ok) return;
    walletLabel.textContent = `${MetaMask.shortAddress()} (${MetaMask.role})`;
    mainContent.style.display = "grid";
  });

  MetaMask.onAccountChange((addr) => {
    if (!addr) { walletLabel.textContent = "Not connected"; return; }
    walletLabel.textContent = `${MetaMask.shortAddress()} (${MetaMask.role})`;
  });

  // ── Publish Announcement ──────────────────────────────────────────────────
  const publishBtn    = document.getElementById("publish-btn");
  const publishStatus = document.getElementById("publish-status");

  publishBtn.addEventListener("click", async () => {
    const content     = document.getElementById("ann-content").value.trim();
    const category    = document.getElementById("ann-category").value;
    const targetGroup = document.getElementById("ann-group").value.trim() || "all";
    if (!content) { setStatus(publishStatus, "Content is required.", "err"); return; }
    if (!MetaMask.account) { setStatus(publishStatus, "Connect wallet first.", "err"); return; }

    setStatus(publishStatus, "Sending transaction via MetaMask...", "");
    publishBtn.disabled = true;
    try {
      const contentHash = window.viem.keccak256(window.viem.toHex(content));
      const calldata = window.viem.encodeFunctionData({
        abi: ABIS.ANNOUNCEMENT_LOG,
        functionName: "publish",
        args: [contentHash, category, targetGroup, content],
      });
      const txHash = await window.ethereum.request({
        method: "eth_sendTransaction",
        params: [{ from: MetaMask.account, to: CONTRACTS.ANNOUNCEMENT_LOG, data: calldata }],
      });
      setStatus(publishStatus, "TX sent, waiting for confirmation & indexing...", "");
      const result = await API.indexAnnouncement(txHash, content, category, targetGroup, MetaMask.account);
      setStatus(publishStatus, `Published on-chain! Announcement ID: ${result.id}`, "ok");
      document.getElementById("ann-content").value = "";
    } catch (err) {
      setStatus(publishStatus, `Error: ${err.message}`, "err");
    } finally {
      publishBtn.disabled = false;
    }
  });

  // ── Register Document ─────────────────────────────────────────────────────
  const docDrop    = document.getElementById("doc-drop");
  const docFile    = document.getElementById("doc-file");
  const docStatus  = document.getElementById("doc-status");
  const docHashPre = document.getElementById("doc-hash-preview");
  const registerBtn= document.getElementById("register-doc-btn");
  let selectedFile = null;
  let selectedFileHash = null;

  docDrop.addEventListener("click", () => docFile.click());
  docDrop.addEventListener("dragover", (e) => { e.preventDefault(); docDrop.classList.add("over"); });
  docDrop.addEventListener("dragleave", () => docDrop.classList.remove("over"));
  docDrop.addEventListener("drop", (e) => { e.preventDefault(); docDrop.classList.remove("over"); handleFile(e.dataTransfer.files[0]); });
  docFile.addEventListener("change", () => handleFile(docFile.files[0]));

  async function handleFile(file) {
    if (!file) return;
    selectedFile = file;
    docDrop.textContent = `Selected: ${file.name}`;
    docHashPre.textContent = "Computing SHA-256...";
    const hash = await hashFile(file);
    selectedFileHash = hash;
    docHashPre.textContent = `SHA-256: ${hash}`;
  }

  registerBtn.addEventListener("click", async () => {
    if (!selectedFile || !selectedFileHash) { setStatus(docStatus, "Select a file first.", "err"); return; }
    if (!MetaMask.account) { setStatus(docStatus, "Connect wallet first.", "err"); return; }
    const targetGroup = document.getElementById("doc-group").value.trim() || "all";

    setStatus(docStatus, "Sending transaction via MetaMask...", "");
    registerBtn.disabled = true;
    try {
      const calldata = window.viem.encodeFunctionData({
        abi: ABIS.DOCUMENT_REGISTRY,
        functionName: "register",
        args: [selectedFileHash, selectedFile.name, targetGroup],
      });
      const txHash = await window.ethereum.request({
        method: "eth_sendTransaction",
        params: [{ from: MetaMask.account, to: CONTRACTS.DOCUMENT_REGISTRY, data: calldata }],
      });
      setStatus(docStatus, "TX sent, waiting for confirmation...", "");
      const result = await API.indexDocument(txHash, targetGroup, MetaMask.account, selectedFile);
      setStatus(docStatus, `Registered on-chain! Document ID: ${result.id}`, "ok");
      selectedFile = null; selectedFileHash = null;
      docDrop.innerHTML = 'Drop PDF / file here or <strong>click to select</strong>';
      docHashPre.textContent = "";
    } catch (err) {
      setStatus(docStatus, `Error: ${err.message}`, "err");
    } finally {
      registerBtn.disabled = false;
    }
  });

  // ── Acknowledgment Tracker ────────────────────────────────────────────────
  document.getElementById("load-acks-btn").addEventListener("click", async () => {
    const id = document.getElementById("ack-ann-id").value;
    if (!id) return;
    const tbody = document.getElementById("ack-body");
    tbody.innerHTML = '<tr><td colspan="2">Loading...</td></tr>';
    try {
      const { acknowledgers } = await API.getAcknowledgments(parseInt(id));
      if (!acknowledgers.length) {
        tbody.innerHTML = '<tr><td colspan="2" style="color:#718096;">No acknowledgments yet.</td></tr>';
        return;
      }
      tbody.innerHTML = acknowledgers
        .map((addr, i) => `<tr><td>${i + 1}</td><td>${addr}</td></tr>`)
        .join("");
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="2" style="color:#c53030;">${err.message}</td></tr>`;
    }
  });

  // ── Assign Role ───────────────────────────────────────────────────────────
  const roleStatus = document.getElementById("role-status");
  document.getElementById("assign-role-btn").addEventListener("click", async () => {
    const address = document.getElementById("role-address").value.trim();
    const role    = document.getElementById("role-select").value;
    const group   = document.getElementById("role-group").value.trim();
    if (!address) { setStatus(roleStatus, "Address is required.", "err"); return; }
    setStatus(roleStatus, "Assigning role via backend (admin wallet)...", "");
    try {
      const result = await API.assignRole(address, role, group);
      setStatus(roleStatus, `Done! ${address.slice(0,8)}... → ${role}${group ? ` (${group})` : ""}`, "ok");
    } catch (err) {
      setStatus(roleStatus, `Error: ${err.message}`, "err");
    }
  });

  // ── Utility ───────────────────────────────────────────────────────────────
  function setStatus(el, msg, type) {
    el.textContent = msg;
    el.className = `status${type ? " " + type : ""}`;
  }
});
