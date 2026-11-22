"use strict";

const API = "https://jsonplaceholder.typicode.com";
const LOGGED_IN_USER_ID = 1;
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "openrouter/free";

const state = {
  users: [],
  posts: [],
  myPosts: [],
  commentsByPost: null,
  liked: new Set(),
  retweeted: new Set(),
  following: new Set(),
  view: { name: "home" },
  chat: [],
  chatOpen: false,
  busy: false
};

/* Helpers */

const $ = (sel, el = document) => el.querySelector(sel);

const esc = s => String(s).replace(/[&<>"']/g, c =>
  ({
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    '"':'&quot;',
    "'":'&#39;'
  }[c])
);

const hueOf = s =>
  [...s].reduce((a,c) => a + c.charCodeAt(0), 0) % 360;

const initials = u =>
  u.name.split(" ").map(w => w[0]).slice(0,2).join("").toUpperCase();

const avatarStyle = u =>
  `background:hsl(${hueOf(u.username)},65%,55%)`;

function avatarHTML(user, cls = "") {
  return `<img class="avatar ${cls}"
    src="https://i.pravatar.cc/150?img=${user.id}"
    alt=""
    loading="lazy"
    onerror="this.outerHTML='<span class=&quot;avatar-fallback ${cls}&quot; data-user=${user.id}  style=&quot;${avatarStyle(user)}&quot;>${initials(user)}</span>'"
    data-user="${user.id}">`;
}

const fmtCount = n =>
  n >= 1000
    ? (n/1000).toFixed(1).replace(/\.0$/,"") + "K"
    : n;

const followersOf = u => 500 + ((u.id * 137) % 4500);
const followingOf = u => 100 + ((u.id * 89) % 700);

const userById = id =>
  state.users.find(u => u.id === id);

function setView(v) {
  state.view = v;

  document.querySelectorAll(".nav-item[data-view]").forEach(b =>
    b.classList.toggle(
      "active",
      b.dataset.view === v.name
    )
  );

  render();
  window.scrollTo(0,0);
}

/* Data loading */

async function loadFeed() {
  const main = $("#main");

  main.innerHTML =
    `<div class="main-header">Home</div>
     <div class="spinner"></div>`;

  try {
    const [users, posts] = await Promise.all([
      fetch(`${API}/users`).then(r => {
        if (!r.ok) throw new Error("users");
        return r.json();
      }),

      fetch(`${API}/posts`).then(r => {
        if (!r.ok) throw new Error("posts");
        return r.json();
      })
    ]);

    state.users = users;
    state.posts = [
  {
    id: 1,
    userId: 1,
    title: "Learning something new every day",
    body: "I'm excited to be learning software development. Every day brings a new challenge and an opportunity to improve."
  },
  {
    id: 2,
    userId: 2,
    title: "Consistency is everything",
    body: "You don't have to know everything to get started. Keep learning, keep practising, and trust the process."
  },
  {
    id: 3,
    userId: 3,
    title: "Technology is changing the world",
    body: "Technology continues to create new opportunities. Learning digital skills is one way to prepare for the future."
  },
  {
    id: 4,
    userId: 4,
    title: "A little progress is still progress",
    body: "Some days are harder than others, but every small step counts. Keep showing up and working towards your goals."
  },
  {
    id: 5,
    userId: 5,
    title: "What's everyone working on?",
    body: "I'd love to hear what projects everyone is building. Share your ideas and let's learn from each other!"
  }
];

    render();
    renderWhoToFollow();

  } catch(err) {
    main.innerHTML = `
      <div class="main-header">Home</div>
      <div class="msg">
        Could not load the feed. Please check your connection.
        <br>
        <button onclick="loadFeed()">Try again</button>
      </div>`;
  }
}

async function loadCommentsOnce() {
  if(state.commentsByPost) return;

  try {
    const all = await fetch(`${API}/comments`).then(r => {
      if(!r.ok) throw 0;
      return r.json();
    });

    state.commentsByPost = {};

    for(const c of all) {
      (state.commentsByPost[c.postId] ??= []).push(c);
    }

  } catch(e) {
    state.commentsByPost = {};
  }

  render();
}

/* Rendering posts */

function postHTML(post) {
  const u = userById(post.userId) ||
    {name:"Unknown", username:"unknown", id:0};

  const liked = state.liked.has(post.id);
  const rt = state.retweeted.has(post.id);

  const comments = state.commentsByPost?.[post.id] || [];
  const open = post._commentsOpen;

  return `
    <article class="post">
      ${avatarHTML(u)}

      <div class="post-body">

        <div class="post-author">
          <b data-user="${u.id}">${esc(u.name)}</b>
          @${esc(u.username)}
        </div>

        <div class="post-text">
          <h3>${esc(post.title)}</h3>
          ${esc(post.body)}
        </div>

        <div class="post-actions">
          <button data-act="comments" data-id="${post.id}">
            Comments (${comments.length})
          </button>

          <button class="like ${liked?"on":""}"
            data-act="like" data-id="${post.id}">
            ${liked?"Liked":"Like"}
          </button>

          <button class="retweet ${rt?"on":""}"
            data-act="retweet" data-id="${post.id}">
            ${rt?"Retweeted":"Retweet"}
          </button>

          <button data-act="summarize" data-id="${post.id}">
            Summarize with AI
          </button>
        </div>

        ${open ? `
          <div class="comments">
            ${
              comments.length
              ? comments.map(c => `
                <div class="comment">
                  <div>
                    <div class="comment-name">
                      ${esc(c.name)}
                      <span class="comment-mail">
                        &lt;${esc(c.email)}&gt;
                      </span>
                    </div>

                    <div class="comment-body">
                      ${esc(c.body)}
                    </div>
                  </div>
                </div>
              `).join("")
              : `<div class="comment-body" style="color:var(--muted)">
                   No comments yet.
                 </div>`
            }
          </div>
        ` : ""}

      </div>
    </article>`;
}

/* Main rendering */

function render() {
  const main = $("#main");

  if(state.view.name === "home") {

    main.innerHTML = `
      <div class="main-header">Home</div>

      <div class="compose">
        ${avatarHTML(
          userById(LOGGED_IN_USER_ID) ||
          state.users[0] ||
          {name:"LG", username:"you", id:0}
        )}

        <div style="flex:1">
          <textarea id="composeText"
            maxlength="280"
            placeholder="What is happening?"></textarea>

          <div class="compose-footer">
            <span class="char-count" id="charCount">280</span>
            <button class="btn-tweet" id="tweetBtn" disabled>
              Tweet
            </button>
          </div>
        </div>
      </div>

      <div id="feed">
        ${state.posts.map(postHTML).join("")}
      </div>`;

    const ta = $("#composeText");
    const cc = $("#charCount");
    const btn = $("#tweetBtn");

    ta.addEventListener("input", () => {
      const left = 280 - ta.value.length;

      cc.textContent = left;
      cc.classList.toggle("over", left < 0);

      btn.disabled =
        ta.value.trim() === "" || left < 0;
    });

    btn.addEventListener("click", () => {
      const body = ta.value.trim();

      if(!body) return;

      state.myPosts.unshift({
        id: "local-" + Date.now(),
        userId: LOGGED_IN_USER_ID,
        title: body.slice(0,40) +
          (body.length > 40 ? "…" : ""),
        body,
        _local: true
      });

      ta.value = "";
      cc.textContent = 280;
      btn.disabled = true;

      render();
    });
  }

  else if(state.view.name === "profile") {

    const u = userById(state.view.userId) ||
      userById(LOGGED_IN_USER_ID);

    if(!u) {
      main.innerHTML = `<div class="msg">Profile not found.</div>`;
      return;
    }

    const posts = state.myPosts.concat(state.posts)
      .filter(p => p.userId === u.id);

    const isMe = u.id === LOGGED_IN_USER_ID;
    const following = state.following.has(u.id);

    main.innerHTML = `
      <div class="main-header">
        ${isMe ? "Profile" : esc(u.name)}
      </div>

      <div class="cover"></div>

      <div class="profile-head">

        ${avatarHTML(u)}

        <div style="text-align:right;margin-top:-34px;">
          <button class="btn-follow ${following?"following":""}"
            data-act="follow" data-id="${u.id}">
            ${following?"Following":"Follow"}
          </button>
        </div>

        <h2>${esc(u.name)}</h2>

        <div class="handle">@${esc(u.username)}</div>

        <p class="profile-bio">
          ${esc(u.company.catchPhrase)}.
        </p>

        <div class="profile-meta">
          <span>💼 ${esc(u.company.name)}</span>
          <span>📍 ${esc(u.address.city)}</span>
          <span>🔗 <a href="https://${esc(u.website)}"
            target="_blank" rel="noopener">
            ${esc(u.website)}</a></span>
          <span>✉️ ${esc(u.email)}</span>
        </div>

        <div class="profile-stats">
          <span><b>${fmtCount(followingOf(u))}</b> Following</span>
          <span><b>${fmtCount(followersOf(u))}</b> Followers</span>
          <span><b>${posts.length}</b> Posts</span>
        </div>

      </div>

      <div class="main-header" style="font-size:16px">
        Posts by ${esc(u.name)}
      </div>

      ${posts.length
        ? posts.map(postHTML).join("")
        : `<div class="msg">No posts yet.</div>`
      }`;
  }
}

/* Who to follow */

function renderWhoToFollow() {
  const box = $("#whoToFollow");

  if(!state.users.length) return;

  const picks = state.users
    .filter(u => u.id !== LOGGED_IN_USER_ID)
    .slice(0,3);

  box.innerHTML = picks.map(u => `
    <div class="who-user">
      ${avatarHTML(u,"sm")}

      <div class="info">
        <b data-user="${u.id}">${esc(u.name)}</b>
        <span>@${esc(u.username)}</span>
      </div>

      <button class="btn-follow ${
        state.following.has(u.id) ? "following" : ""
      }" data-act="follow" data-id="${u.id}">
        ${state.following.has(u.id) ? "Following" : "Follow"}
      </button>
    </div>
  `).join("");
}

/* Events */

$("#main").addEventListener("click", async e => {

  const userEl = e.target.closest("[data-user]");
  const actEl = e.target.closest("[data-act]");

  if(actEl) {

    const id = isNaN(actEl.dataset.id)
      ? actEl.dataset.id
      : +actEl.dataset.id;

    const post = state.myPosts.concat(state.posts)
      .find(p => p.id === id);

    switch(actEl.dataset.act) {

      case "like":
        state.liked.has(id)
          ? state.liked.delete(id)
          : state.liked.add(id);
        render();
        break;

      case "retweet":
        state.retweeted.has(id)
          ? state.retweeted.delete(id)
          : state.retweeted.add(id);
        render();
        break;

      case "comments":
        if(!post) return;
        post._commentsOpen = !post._commentsOpen;

        if(post._commentsOpen) {
          await loadCommentsOnce();
        } else {
          render();
        }
        break;

      case "summarize":
        if(!post) return;
        await loadCommentsOnce();
        summarizePost(post);
        break;

      case "follow":
        state.following.has(id)
          ? state.following.delete(id)
          : state.following.add(id);

        render();
        renderWhoToFollow();
        break;
    }

    return;
  }

  if(userEl) {
    setView({
      name: "profile",
      userId: +userEl.dataset.user
    });
  }
});

/* Navigation */

document.querySelectorAll(".nav-item[data-view]")
  .forEach(btn => {

    btn.addEventListener("click", () => {

      if(btn.dataset.view === "ask") {
        toggleChat(true);
        return;
      }

      setView(
        btn.dataset.view === "profile"
          ? {name:"profile", userId:LOGGED_IN_USER_ID}
          : {name:"home"}
      );

    });

  });

/* AI Chat */

function getKey() {
  return localStorage.getItem("openrouter_key") || "";
}

async function callOpenRouter() {

  const key = getKey();

  if(!key) throw new Error("NO_KEY");

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",

    headers: {
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json"
    },

    body: JSON.stringify({
      model: MODEL,
      messages: state.chat
    })
  });

  if(!res.ok) throw new Error("HTTP " + res.status);

  const data = await res.json();

  const text = data.choices?.[0]?.message?.content;

  if(!text) throw new Error("Empty response");

  return text.trim();
}

function bubble(role, text) {

  const div = document.createElement("div");

  div.className = "bubble " + role;
  div.textContent = text;

  $("#aiMessages").appendChild(div);

  $("#aiMessages").scrollTop =
    $("#aiMessages").scrollHeight;

  return div;
}

async function sendChat(userText) {

  if(state.busy || !userText.trim()) return;

  state.chat.push({
    role: "user",
    content: userText.trim()
  });

  bubble("user", userText.trim());

  $("#aiInput").value = "";

  state.busy = true;
  $("#aiSend").disabled = true;

  const think = document.createElement("div");

  think.className = "thinking";
  think.textContent = "Thinking";

  $("#aiMessages").appendChild(think);

  $("#aiMessages").scrollTop =
    $("#aiMessages").scrollHeight;

  try {

    const reply = await callOpenRouter();

    state.chat.push({
      role: "assistant",
      content: reply
    });

    think.remove();
    bubble("ai", reply);

  } catch(err) {

    think.remove();
    state.chat.pop();

    if(err.message === "NO_KEY") {

      bubble(
        "error",
        "Set your OpenRouter API key first (Key button, top right). Get one free at openrouter.ai/keys."
      );

    } else {

      bubble(
        "error",
        "AI request failed (" + err.message + "). Please try again."
      );

    }

  } finally {

    state.busy = false;
    $("#aiSend").disabled = false;

  }
}

function summarizePost(post) {

  toggleChat(true);

  const u = userById(post.userId) ||
    {name:"Unknown", username:"unknown"};

  const comments = (
    state.commentsByPost?.[post.id] || []
  )
    .map(c => `- ${c.name}: ${c.body}`)
    .join("\n") || "(no comments)";

  const prompt =
    `Summarize this post by ${u.name} (@${u.username}) in 1-2 short sentences, ` +
    `then briefly say what the commenters think.\n\n` +
    `Post: ${post.title}\n${post.body}\n\n` +
    `Comments:\n${comments}`;

  sendChat(prompt);
}

function toggleChat(force) {

  state.chatOpen =
    force !== undefined ? force : !state.chatOpen;

  $("#aiPanel").classList.toggle(
    "hidden",
    !state.chatOpen
  );
}

/* AI buttons */

$("#aiFab").addEventListener("click", () => toggleChat());

$("#aiClose").addEventListener("click", () =>
  toggleChat(false)
);

$("#aiSend").addEventListener("click", () =>
  sendChat($("#aiInput").value)
);

$("#aiInput").addEventListener("keydown", e => {
  if(e.key === "Enter") {
    sendChat($("#aiInput").value);
  }
});

$("#aiKeyBtn").addEventListener("click", () => {

  const k = prompt(
    "Paste your OpenRouter API key (stored only in your browser):",
    getKey()
  );

  if(k !== null) {
    localStorage.setItem("openrouter_key", k.trim());
  }

});

/* Initialize */

(function init() {

  ["profileDot","profileDotM"].forEach(id => {

    const el = document.getElementById(id);

    if(el) {
      el.style.background =
        `hsl(${hueOf("you")},65%,55%)`;

      el.textContent = "Y";
    }

  });

})();

loadFeed();