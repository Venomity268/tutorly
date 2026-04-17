(function () {
  const API_BASE = `${window.location.protocol}//${window.location.hostname}:7503`;
  const AUTH_TOKEN_KEY = "tutorly_token";
  const AUTH_USER_KEY = "tutorly_user";

  function getToken() {
    return localStorage.getItem(AUTH_TOKEN_KEY) ?? sessionStorage.getItem(AUTH_TOKEN_KEY);
  }

  function getUser() {
    const raw = localStorage.getItem(AUTH_USER_KEY) ?? sessionStorage.getItem(AUTH_USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function clearStoredAuth() {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
    sessionStorage.removeItem(AUTH_TOKEN_KEY);
    sessionStorage.removeItem(AUTH_USER_KEY);
  }

  function redirectToLogin() {
    clearStoredAuth();
    window.location.replace("./onboarding.html?mode=login");
  }

  async function api(path, opts = {}) {
    const token = getToken();
    const res = await fetch(API_BASE + path, {
      ...opts,
      headers: {
        "Content-Type": "application/json",
        Authorization: token ? `Bearer ${token}` : "",
        ...opts.headers,
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) {
      clearStoredAuth();
      window.location.replace("./onboarding.html?mode=login");
      throw new Error(data.message || data.error || "Session expired");
    }
    if (!res.ok) throw new Error(data.message || data.error || "Request failed");
    return data;
  }

  // Guard: must be admin
  document.addEventListener("DOMContentLoaded", () => {
    const user = getUser();
    if (!user || user.role !== "admin") {
      redirectToLogin();
      return;
    }

    initTabs();
    loadOverview();
    loadTutors();
    loadCourses();
    initResetPassword();
    initLogout();
  });

  function initTabs() {
    document.querySelectorAll(".admin-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        const t = tab.dataset.tab;
        document.querySelectorAll(".admin-tab").forEach((x) => x.classList.remove("active"));
        document.querySelectorAll(".admin-panel").forEach((x) => x.classList.remove("active"));
        tab.classList.add("active");
        const panel = document.getElementById("admin-" + t);
        if (panel) panel.classList.add("active");
        if (t === "tutors") loadTutors();
        if (t === "courses") loadCourses();
      });
    });
  }

  async function loadOverview() {
    try {
      const { totalUsers, totalTutors, pendingTutors, totalCourses } = await api("/admin/stats");
      document.getElementById("admin-stats").innerHTML = `
        <div class="admin-stat-card"><div class="value">${totalUsers}</div><div class="label">Users</div></div>
        <div class="admin-stat-card"><div class="value">${totalTutors}</div><div class="label">Tutors</div></div>
        <div class="admin-stat-card"><div class="value">${pendingTutors}</div><div class="label">Pending</div></div>
        <div class="admin-stat-card"><div class="value">${totalCourses}</div><div class="label">Courses</div></div>
      `;

      const { tutors } = await api("/admin/tutors?status=pending");
      const list = document.getElementById("admin-pending-list");
      const section = document.getElementById("admin-pending-section");
      if (tutors.length === 0) {
        section.style.display = "none";
      } else {
        section.style.display = "block";
        list.innerHTML = tutors
          .map(
            (t) => `
          <div class="admin-pending-item">
            <span><strong>${t.fullName}</strong> - ${t.email}</span>
            <span>
              <button class="btn-sm approve" data-id="${t.id}">Approve</button>
              <button class="btn-sm reject" data-id="${t.id}">Reject</button>
            </span>
          </div>
        `
          )
          .join("");
        list.querySelectorAll(".btn-sm.approve").forEach((b) =>
          b.addEventListener("click", () => approveTutor(b.dataset.id))
        );
        list.querySelectorAll(".btn-sm.reject").forEach((b) =>
          b.addEventListener("click", () => rejectTutor(b.dataset.id))
        );
      }
    } catch (e) {
      if (e.message.includes("401") || e.message.includes("403")) redirectToLogin();
    }
  }

  async function approveTutor(id) {
    try {
      await api("/admin/tutors/" + id + "/approve", { method: "PATCH" });
      loadOverview();
      loadTutors();
    } catch (e) {
      alert(e.message);
    }
  }

  async function rejectTutor(id) {
    try {
      await api("/admin/tutors/" + id + "/reject", { method: "PATCH" });
      loadOverview();
      loadTutors();
    } catch (e) {
      alert(e.message);
    }
  }

  function tutorManagementActions(t) {
    const id = t.id;
    const s = t.verificationStatus;
    const approve = `<button type="button" class="btn-sm approve" data-id="${id}">Approve</button>`;
    const reject = `<button type="button" class="btn-sm reject" data-id="${id}">Reject</button>`;
    const revoke = `<button type="button" class="btn-sm reject" data-id="${id}" title="Remove approval">Revoke</button>`;
    if (s === "pending") return approve + reject;
    if (s === "approved") return revoke;
    if (s === "rejected") return approve;
    return "-";
  }

  async function loadTutors() {
    const filter = document.getElementById("tutor-status-filter")?.value || "";
    const q = filter ? "?status=" + filter : "";
    try {
      const { tutors } = await api("/admin/tutors" + q);
      const tbody = document.getElementById("tutors-tbody");
      tbody.innerHTML = tutors
        .map(
          (t) => `
        <tr>
          <td>${t.fullName}</td>
          <td>${t.email}</td>
          <td>${(t.subjects || []).join(", ") || "-"}</td>
          <td>$${t.hourlyRate || 0}/hr</td>
          <td><span class="status-badge ${t.verificationStatus}">${t.verificationStatus}</span></td>
          <td class="admin-tutor-actions">${tutorManagementActions(t)}</td>
        </tr>
      `
        )
        .join("");
      tbody.querySelectorAll(".btn-sm.approve").forEach((b) =>
        b.addEventListener("click", () => approveTutor(b.dataset.id))
      );
      tbody.querySelectorAll(".btn-sm.reject").forEach((b) =>
        b.addEventListener("click", () => rejectTutor(b.dataset.id))
      );
    } catch (e) {
      if (e.message.includes("401") || e.message.includes("403")) redirectToLogin();
    }
  }

  document.getElementById("tutor-status-filter")?.addEventListener("change", loadTutors);

  async function loadCourses() {
    try {
      const { courses } = await api("/admin/courses");
      const tbody = document.getElementById("courses-tbody");
      tbody.innerHTML = courses
        .map(
          (c) => `
        <tr>
          <td>${c.name}</td>
          <td><code>${c.slug}</code></td>
          <td>${c.active ? "Yes" : "No"}</td>
          <td><button class="btn-sm delete" data-id="${c.id}">Delete</button></td>
        </tr>
      `
        )
        .join("");
      tbody.querySelectorAll(".btn-sm.delete").forEach((b) =>
        b.addEventListener("click", () => deleteCourse(b.dataset.id))
      );
    } catch (e) {
      if (e.message.includes("401") || e.message.includes("403")) redirectToLogin();
    }
  }

  document.getElementById("add-course-btn")?.addEventListener("click", async () => {
    const name = document.getElementById("new-course-name")?.value?.trim();
    const slug = document.getElementById("new-course-slug")?.value?.trim();
    if (!name) {
      alert("Course name is required");
      return;
    }
    try {
      await api("/admin/courses", {
        method: "POST",
        body: { name, slug: slug || undefined },
      });
      document.getElementById("new-course-name").value = "";
      document.getElementById("new-course-slug").value = "";
      loadCourses();
      loadOverview();
    } catch (e) {
      alert(e.message);
    }
  });

  async function deleteCourse(id) {
    if (!confirm("Delete this course?")) return;
    try {
      await api("/admin/courses/" + id, { method: "DELETE" });
      loadCourses();
      loadOverview();
    } catch (e) {
      alert(e.message);
    }
  }

  function initResetPassword() {
    document.getElementById("reset-submit")?.addEventListener("click", async () => {
      const email = document.getElementById("reset-email")?.value?.trim();
      const password = document.getElementById("reset-password")?.value;
      const msg = document.getElementById("reset-message");
      msg.textContent = "";
      msg.classList.remove("visible");
      if (!email || !password || password.length < 8) {
        msg.textContent = "Email and password (min 8 chars) required.";
        msg.classList.add("visible");
        return;
      }
      try {
        await api("/admin/users/reset-password-by-email", {
          method: "POST",
          body: { email, newPassword: password },
        });
        msg.style.background = "#d1fae5";
        msg.style.color = "#047857";
        msg.textContent = "Password updated successfully.";
        msg.classList.add("visible");
      } catch (e) {
        msg.style.background = "";
        msg.style.color = "";
        msg.textContent = e.message;
        msg.classList.add("visible");
      }
    });
  }

  function initLogout() {
    document.getElementById("admin-logout")?.addEventListener("click", redirectToLogin);
  }
})();
