document.addEventListener("DOMContentLoaded", () => {
  const connectBtn    = document.getElementById("connect-btn");
  const walletLabel   = document.getElementById("wallet-label");
  const mainContent   = document.getElementById("main-content");
  const announcList   = document.getElementById("announcements-list");
  const chatMessages  = document.getElementById("chat-messages");
  const chatInput     = document.getElementById("chat-input");
  const chatSend      = document.getElementById("chat-send");
  const dropZone      = document.getElementById("drop-zone");
  const fileInput     = document.getElementById("file-input");
  const verifyResult  = document.getElementById("verify-result");
  const verifyDocId   = document.getElementById("verify-doc-id");

  // ── Wallet connect ────────────────────────────────────────────────────────
  connectBtn.addEventListener("click", async () => {
    const ok = await MetaMask.connect();
    if (!ok) return;
    walletLabel.textContent = `${MetaMask.shortAddress()} (${MetaMask.role} / ${MetaMask.group || "no group"})`;
    mainContent.style.display = "grid";
    loadAnnouncements();
  });

  MetaMask.onAccountChange((addr) => {
    if (!addr) { walletLabel.textContent = "Not connected"; return; }
    walletLabel.textContent = `${MetaMask.shortAddress()} (${MetaMask.role} / ${MetaMask.group || "no group"})`;
    loadAnnouncements();
  });

  // ── Announcements ─────────────────────────────────────────────────────────
  async function loadAnnouncements() {
    announcList.innerHTML = '<p style="color:#718096;font-size:0.85rem;">Loading...</p>';
    try {
      const { announcements } = await API.getAnnouncements(MetaMask.account);
      if (!announcements.length) {
        announcList.innerHTML = '<p style="color:#718096;font-size:0.85rem;">No announcements yet.</p>';
        return;
      }
      announcList.innerHTML = "";
      for (const a of announcements) {
        const card = document.createElement("div");
        card.className = "announcement-card";
        const ts = new Date(Number(a.timestamp) * 1000).toLocaleString();
        card.innerHTML = `
          <div class="meta">
            <span class="tag">${a.category}</span>
            <span class="tag">${a.targetGroup}</span>
            ${ts} &nbsp;·&nbsp; #${a.id}
          </div>
          <div class="content">${escapeHtml(a.content)}</div>
          <button class="ack-btn" data-id="${a.id}">✔ I've read this</button>
        `;
        const btn = card.querySelector(".ack-btn");
        btn.addEventListener("click", () => acknowledgeAnnouncement(btn, BigInt(a.id)));
        announcList.appendChild(card);
      }
    } catch (err) {
      announcList.innerHTML = `<p style="color:#c53030;">${err.message}</p>`;
    }
  }

  async function acknowledgeAnnouncement(btn, announcementId) {
    btn.disabled = true;
    btn.textContent = "Signing...";
    try {
      const calldata = window.viem.encodeFunctionData({
        abi: ABIS.ACKNOWLEDGMENT_LOG,
        functionName: "acknowledge",
        args: [announcementId],
      });
      const txHash = await window.ethereum.request({
        method: "eth_sendTransaction",
        params: [{ from: MetaMask.account, to: CONTRACTS.ACKNOWLEDGMENT_LOG, data: calldata }],
      });
      await API.acknowledge(announcementId.toString(), txHash, MetaMask.account);
      btn.textContent = "✔ Acknowledged (on-chain)";
      btn.style.background = "#68d391";
    } catch (err) {
      btn.disabled = false;
      btn.textContent = "✔ I've read this";
      alert(`Error: ${err.message}`);
    }
  }

  // ── Chat ──────────────────────────────────────────────────────────────────
  function addMessage(text, type) {
    const div = document.createElement("div");
    div.className = `msg ${type}`;
    div.textContent = type === "user" ? `You: ${text}` : text;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  chatSend.addEventListener("click", sendChat);
  chatInput.addEventListener("keypress", (e) => { if (e.key === "Enter") sendChat(); });

  async function sendChat() {
    const q = chatInput.value.trim();
    if (!q || !MetaMask.account) return;
    chatInput.value = "";
    addMessage(q, "user");
    const thinking = document.createElement("div");
    thinking.className = "msg bot";
    thinking.textContent = "Thinking...";
    chatMessages.appendChild(thinking);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    try {
      const { answer } = await API.chat(q, MetaMask.account);
      thinking.textContent = answer;
    } catch (err) {
      thinking.className = "msg err";
      thinking.textContent = `Error: ${err.message}`;
    }
  }

  // ── Document verifier ─────────────────────────────────────────────────────
  dropZone.addEventListener("click", () => fileInput.click());
  dropZone.addEventListener("dragover", (e) => { e.preventDefault(); dropZone.classList.add("over"); });
  dropZone.addEventListener("dragleave", () => dropZone.classList.remove("over"));
  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("over");
    const file = e.dataTransfer.files[0];
    if (file) verifyFile(file);
  });
  fileInput.addEventListener("change", () => {
    if (fileInput.files[0]) verifyFile(fileInput.files[0]);
  });

  async function verifyFile(file) {
    const docId = verifyDocId.value;
    if (!docId) { alert("Enter the Document ID first."); return; }
    verifyResult.textContent = "Hashing file...";
    verifyResult.className = "verify-result";
    dropZone.textContent = `Selected: ${file.name}`;
    try {
      const { valid, fileHash } = await API.verifyDocumentHash(parseInt(docId), file);
      verifyResult.className = `verify-result ${valid ? "valid" : "invalid"}`;
      verifyResult.textContent = valid
        ? `VERIFIED ✓ — File matches the on-chain record (SHA-256: ${fileHash.slice(0,10)}…)`
        : `TAMPERED ✗ — File hash does NOT match the on-chain record`;
    } catch (err) {
      verifyResult.className = "verify-result invalid";
      verifyResult.textContent = `Error: ${err.message}`;
    }
  }

  function escapeHtml(str) {
    return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  }
});
