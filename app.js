const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

let currentUser = null;
let currentCoaching = null;
let authMode = "login";

function $(id) {
  return document.getElementById(id);
}

function escapeHtml(text = "") {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

/* =========================
   PAGE SHOW
========================= */

function show(page) {
  document.querySelectorAll(".page").forEach(function (item) {
    item.classList.add("hidden");
  });

  const pageElement = $(page);

  if (pageElement) {
    pageElement.classList.remove("hidden");
  }

  window.scrollTo(0, 0);
}

window.show = show;

/* =========================
   LOGIN / REGISTER MODE
========================= */

function mode(type) {
  authMode = type;

  $("loginTab").classList.remove("active");
  $("regTab").classList.remove("active");

  if (type === "login") {
    $("loginTab").classList.add("active");
    $("authSubmit").textContent = "Login";
  } else {
    $("regTab").classList.add("active");
    $("authSubmit").textContent = "Create Account";
  }

  $("authMsg").textContent = "";
}

window.mode = mode;

/* =========================
   NAVIGATION
========================= */

function updateNavigation() {
  if (currentUser) {
    $("authBtn").classList.add("hidden");
    $("dashBtn").classList.remove("hidden");
    $("logoutBtn").classList.remove("hidden");
  } else {
    $("authBtn").classList.remove("hidden");
    $("dashBtn").classList.add("hidden");
    $("logoutBtn").classList.add("hidden");
  }
}

/* =========================
   AUTH FORM
========================= */

$("authForm").addEventListener("submit", async function (event) {

  event.preventDefault();

  const email = $("email").value.trim();
  const password = $("password").value;

  $("authMsg").textContent = "Please wait...";

  let result;

  if (authMode === "register") {

    result = await supabaseClient.auth.signUp({
      email: email,
      password: password
    });

  } else {

    result = await supabaseClient.auth.signInWithPassword({
      email: email,
      password: password
    });

  }

  if (result.error) {
    $("authMsg").textContent = "❌ " + result.error.message;
    return;
  }

  if (authMode === "register" && !result.data.session) {

    $("authMsg").textContent =
      "✅ Account created! Please check your email.";

    return;
  }

  currentUser =
    result.data.user ||
    (result.data.session ? result.data.session.user : null);

  updateNavigation();

  $("authMsg").textContent = "";

  dashboard();
});

/* =========================
   LOGOUT
========================= */

async function logout() {

  await supabaseClient.auth.signOut();

  currentUser = null;
  currentCoaching = null;

  updateNavigation();

  show("home");
}

window.logout = logout;

/* =========================
   DASHBOARD
========================= */

async function dashboard() {

  if (!currentUser) {
    show("auth");
    return;
  }

  history.replaceState(
    null,
    "",
    window.location.pathname
  );

  show("dash");

  const result = await supabaseClient
    .from("coachings")
    .select("*")
    .eq("owner_id", currentUser.id)
    .maybeSingle();

  if (result.error) {
    console.error(result.error);
    return;
  }

  currentCoaching = result.data;

  if (!currentCoaching) {

    $("linkBox").classList.add("hidden");
    $("batches").innerHTML =
      "<p>पहले Coaching Information Save करें।</p>";

    return;
  }

  $("coachingName").value =
    currentCoaching.coaching_name || "";

  $("slug").value =
    currentCoaching.slug || "";

  $("description").value =
    currentCoaching.description || "";

  $("founderName").value =
    currentCoaching.founder_name || "";

  $("designation").value =
    currentCoaching.founder_designation || "Director";

  $("phone").value =
    currentCoaching.phone || "";

  $("contactEmail").value =
    currentCoaching.email || "";

  $("address").value =
    currentCoaching.address || "";

  if (currentCoaching.logo_url) {

    $("logoPreview").src =
      currentCoaching.logo_url;

    $("logoPreview").classList.remove("hidden");
  }

  if (currentCoaching.founder_photo_url) {

    $("founderPreview").src =
      currentCoaching.founder_photo_url;

    $("founderPreview").classList.remove("hidden");
  }

  updatePublicLink();

  loadBatches();
}

window.dashboard = dashboard;

/* =========================
   IMAGE PREVIEW
========================= */

$("logo").addEventListener("change", function (event) {

  const file = event.target.files[0];

  if (!file) return;

  $("logoPreview").src =
    URL.createObjectURL(file);

  $("logoPreview").classList.remove("hidden");
});


$("founderPhoto").addEventListener("change", function (event) {

  const file = event.target.files[0];

  if (!file) return;

  $("founderPreview").src =
    URL.createObjectURL(file);

  $("founderPreview").classList.remove("hidden");
});

/* =========================
   IMAGE UPLOAD
========================= */

async function uploadImage(file, folder) {

  if (!file) return null;

  const extension =
    file.name.split(".").pop();

  const filePath =
    currentUser.id +
    "/" +
    folder +
    "-" +
    Date.now() +
    "." +
    extension;

  const uploadResult =
    await supabaseClient
      .storage
      .from("coaching-images")
      .upload(filePath, file);

  if (uploadResult.error) {
    throw uploadResult.error;
  }

  const urlResult =
    supabaseClient
      .storage
      .from("coaching-images")
      .getPublicUrl(filePath);

  return urlResult.data.publicUrl;
}

/* =========================
   SAVE COACHING
========================= */

$("coachingForm").addEventListener(
  "submit",
  async function (event) {

    event.preventDefault();

    try {

      $("saveMsg").textContent =
        "Saving...";

      let logoUrl =
        currentCoaching
          ? currentCoaching.logo_url
          : null;

      let founderPhotoUrl =
        currentCoaching
          ? currentCoaching.founder_photo_url
          : null;


      const logoFile =
        $("logo").files[0];

      const founderFile =
        $("founderPhoto").files[0];


      if (logoFile) {

        logoUrl =
          await uploadImage(
            logoFile,
            "logo"
          );
      }


      if (founderFile) {

        founderPhotoUrl =
          await uploadImage(
            founderFile,
            "founder"
          );
      }


      const slug =
        $("slug")
          .value
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9-]/g, "-")
          .replace(/-+/g, "-")
          .replace(/^-|-$/g, "");


      const coachingData = {

        owner_id: currentUser.id,

        coaching_name:
          $("coachingName").value.trim(),

        slug: slug,

        description:
          $("description").value.trim(),

        logo_url: logoUrl,

        founder_name:
          $("founderName").value.trim(),

        founder_designation:
          $("designation").value.trim(),

        founder_photo_url:
          founderPhotoUrl,

        phone:
          $("phone").value.trim(),

        email:
          $("contactEmail").value.trim(),

        address:
          $("address").value.trim(),

        updated_at:
          new Date().toISOString()
      };


      let result;

      if (currentCoaching) {

        result =
          await supabaseClient
            .from("coachings")
            .update(coachingData)
            .eq("id", currentCoaching.id)
            .select()
            .single();

      } else {

        result =
          await supabaseClient
            .from("coachings")
            .insert(coachingData)
            .select()
            .single();
      }


      if (result.error) {
        throw result.error;
      }


      currentCoaching =
        result.data;


      $("saveMsg").textContent =
        "✅ Coaching सफलतापूर्वक Save हो गई!";


      updatePublicLink();

      loadBatches();

    } catch (error) {

      console.error(error);

      $("saveMsg").textContent =
        "❌ " + error.message;
    }

  }
);

/* =========================
   PUBLIC LINK
========================= */

function updatePublicLink() {

  if (!currentCoaching) return;

  const baseUrl =
    window.location.origin +
    window.location.pathname;

  $("publicLink").value =
    baseUrl +
    "#/c/" +
    encodeURIComponent(
      currentCoaching.slug
    );

  $("linkBox").classList.remove("hidden");
}


/* =========================
   COPY LINK
========================= */

async function copyLink() {

  try {

    await navigator.clipboard.writeText(
      $("publicLink").value
    );

    alert("✅ Link Copied!");

  } catch (error) {

    $("publicLink").select();

    document.execCommand("copy");

    alert("✅ Link Copied!");
  }
}

window.copyLink = copyLink;


/* =========================
   OPEN LINK
========================= */

function openLink() {

  window.location.href =
    $("publicLink").value;
}

window.openLink = openLink;


/* =========================
   ADD BATCH
========================= */

async function addBatch() {

  if (!currentCoaching) {

    alert(
      "पहले Coaching Information Save करें।"
    );

    return;
  }


  const batchName =
    $("batchName").value.trim();

  const batchDescription =
    $("batchDesc").value.trim();


  if (!batchName) {

    alert("Batch Name डालें।");

    return;
  }


  const result =
    await supabaseClient
      .from("batches")
      .insert({

        coaching_id:
          currentCoaching.id,

        batch_name:
          batchName,

        description:
          batchDescription

      });


  if (result.error) {

    alert("❌ " + result.error.message);

    return;
  }


  $("batchName").value = "";
  $("batchDesc").value = "";

  loadBatches();
}

window.addBatch = addBatch;


/* =========================
   LOAD BATCHES
========================= */

async function loadBatches() {

  if (!currentCoaching) return;


  const result =
    await supabaseClient
      .from("batches")
      .select("*")
      .eq(
        "coaching_id",
        currentCoaching.id
      )
      .order(
        "created_at",
        { ascending: false }
      );


  if (result.error) {

    console.error(result.error);

    return;
  }


  const batches =
    result.data || [];


  if (batches.length === 0) {

    $("batches").innerHTML =
      "<p>अभी कोई Batch नहीं है।</p>";

    return;
  }


  $("batches").innerHTML =
    batches.map(function (batch) {

      return `
        <div class="batch-item">

          <div>

            <b>
              ${escapeHtml(batch.batch_name)}
            </b>

            <p>
              ${escapeHtml(
                batch.description || ""
              )}
            </p>

          </div>

        </div>
      `;

    }).join("");
}


/* =========================
   PUBLIC PAGE
========================= */

async function loadPublicPage(slug) {

  show("public");

  $("publicContent").innerHTML =
    "<p class='loading'>Loading...</p>";


  const result =
    await supabaseClient
      .from("coachings")
      .select("*")
      .eq("slug", slug)
      .single();


  if (result.error || !result.data) {

    $("publicContent").innerHTML = `
      <div class="card">

        <h1>Page Not Found</h1>

        <p>
          यह Coaching Page उपलब्ध नहीं है।
        </p>

        <button
          class="primary"
          onclick="show('home')"
        >
          Home
        </button>

      </div>
    `;

    return;
  }


  const coaching =
    result.data;


  const batchResult =
    await supabaseClient
      .from("batches")
      .select("*")
      .eq(
        "coaching_id",
        coaching.id
      );


  const batches =
    batchResult.data || [];


  $("publicContent").innerHTML = `

    <div class="wrap">

      <div class="card public-header">

        ${
          coaching.logo_url
            ? `<img class="public-logo"
                 src="${coaching.logo_url}">`
            : "🎓"
        }

        <h1>
          ${escapeHtml(
            coaching.coaching_name
          )}
        </h1>

        <p>
          ${escapeHtml(
            coaching.description || ""
          )}
        </p>

      </div>


      <div class="card">

        <h2>📚 Current Batches</h2>

        ${
          batches.length
            ? batches.map(function (batch) {

                return `
                  <div class="public-batch">

                    <h3>
                      ${escapeHtml(
                        batch.batch_name
                      )}
                    </h3>

                    <p>
                      ${escapeHtml(
                        batch.description || ""
                      )}
                    </p>

                  </div>
                `;

              }).join("")

            : "<p>अभी कोई Batch उपलब्ध नहीं है।</p>"
        }

      </div>


      <div class="card">

        <h2>
          👨‍🏫
          ${escapeHtml(
            coaching.founder_designation ||
            "Director"
          )}
        </h2>

        ${
          coaching.founder_photo_url
            ? `<img
                 class="founder-photo"
                 src="${coaching.founder_photo_url}"
               >`
            : ""
        }

        <h3>
          ${escapeHtml(
            coaching.founder_name || ""
          )}
        </h3>

      </div>


      <div class="card">

        <h2>📞 Contact Details</h2>

        <p>
          📱 ${escapeHtml(
            coaching.phone || ""
          )}
        </p>

        <p>
          ✉️ ${escapeHtml(
            coaching.email || ""
          )}
        </p>

        <p>
          📍 ${escapeHtml(
            coaching.address || ""
          )}
        </p>

      </div>


      <a
        class="primary student-login"
        href="https://portal.greatindia.technology/"
      >
        🎓 Student Login / Register
      </a>

    </div>
  `;
}


/* =========================
   CHECK PUBLIC LINK
========================= */

function checkPublicPage() {

  const match =
    window.location.hash.match(
      /^#\/c\/([^/?#]+)/
    );


  if (match) {

    const slug =
      decodeURIComponent(match[1]);

    loadPublicPage(slug);

  } else {

    show("home");
  }
}


window.addEventListener(
  "hashchange",
  checkPublicPage
);


/* =========================
   START APP
========================= */

async function init() {

  try {

    const sessionResult =
      await supabaseClient
        .auth
        .getSession();

    currentUser =
      sessionResult.data.session
        ? sessionResult.data.session.user
        : null;

    updateNavigation();

    checkPublicPage();

  } catch (error) {

    console.error(error);

    show("home");
  }
}


init();
