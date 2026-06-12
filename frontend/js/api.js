// API_BASE is declared in metamask.js, which must be loaded before this file.

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, options);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Request failed");
  return json;
}

const API = {
  getRole: (address) => apiFetch(`/roles/${address}`),

  assignRole: (address, role, group) =>
    apiFetch("/roles/assign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address, role, group }),
    }),

  getAnnouncements: (callerAddress) =>
    apiFetch(`/announcements?callerAddress=${callerAddress}`),

  indexAnnouncement: (txHash, content, category, targetGroup, callerAddress) =>
    apiFetch("/announcements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ txHash, content, category, targetGroup, callerAddress }),
    }),

  verifyAnnouncement: (id, content) =>
    apiFetch(`/announcements/verify/${id}?content=${encodeURIComponent(content)}`),

  getDocuments: (callerAddress) =>
    apiFetch(`/documents?callerAddress=${callerAddress}`),

  indexDocument: (txHash, targetGroup, callerAddress, file) => {
    const formData = new FormData();
    formData.append("txHash", txHash);
    formData.append("targetGroup", targetGroup);
    formData.append("callerAddress", callerAddress);
    if (file) formData.append("file", file);
    return apiFetch("/documents", { method: "POST", body: formData });
  },

  verifyDocumentHash: (docId, file) => {
    const formData = new FormData();
    formData.append("docId", docId.toString());
    formData.append("file", file);
    return apiFetch("/documents/verify-hash", { method: "POST", body: formData });
  },

  chat: (question, callerAddress) =>
    apiFetch("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, callerAddress }),
    }),

  acknowledge: (announcementId, txHash, callerAddress) =>
    apiFetch(`/acknowledge/${announcementId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ txHash, callerAddress }),
    }),

  getAcknowledgments: (announcementId) =>
    apiFetch(`/acknowledge/${announcementId}`),
};
