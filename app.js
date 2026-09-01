const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const $ = (id) => document.getElementById(id);

let authMode = "login";
let user = null;
let coaching = null;

function showPage(id){
  document.querySelectorAll(".page").forEach(x => x.classList.add("hidden"));
  $(id).classList.remove("hidden");
}

function setAuthMode(mode){
  authMode = mode;
  $("loginTab").classList.toggle("active", mode === "login");
  $("registerTab").classList.toggle("active", mode === "register");
  $("authSubmit").textContent = mode === "login" ? "Login" : "Create Account";
  $("authMessage").textContent = "";
}

$("authForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = $("email").value.trim();
  const password = $("password").value;

  $("authMessage").textContent = "Please wait...";

  if(authMode === "register"){
    const {error} = await sb.auth.signUp({email,password});
    if(error){ $("authMessage").textContent = "❌ " + error.message; return; }
    $("authMessage").textContent = "✅ Account created. अब Login करें।";
    setAuthMode("login");
    return;
  }

  const {data,error} = await sb.auth.signInWithPassword({email,password});
  if(error){ $("authMessage").textContent = "❌ " + error.message; return; }

  user = data.user;
  updateNav();
  await showDashboard();
});

function updateNav(){
  $("authNav").classList.toggle("hidden", !!user);
  $("dashNav").classList.toggle("hidden", !user);
  $("logoutNav").classList.toggle("hidden", !user);
}

async function showDashboard(){
  if(!user){ showPage("auth"); return; }
  showPage("dashboard");
  await loadCoaching();
}

async function logoutUser(){
  await sb.auth.signOut();
  user = null;
  coaching = null;
  updateNav();
  showPage("home");
}

function slugify(v){
  return v.toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g,"")
    .replace(/\s+/g,"-")
    .replace(/-+/g,"-");
}

$("coachingName").addEventListener("input", () => {
  if(!$("slug").dataset.edited) $("slug").value = slugify($("coachingName").value);
});
$("slug").addEventListener("input", () => $("slug").dataset.edited = "yes");

async function loadCoaching(){
  const {data,error} = await sb.from("coachings").select("*").eq("owner_id",user.id).maybeSingle();
  if(error){ console.error(error); return; }

  coaching = data || null;
  if(!coaching){
    $("linkBox").classList.add("hidden");
    $("batchList").innerHTML = "";
    return;
  }

  $("coachingName").value = coaching.coaching_name || "";
  $("slug").value = coaching.slug || "";
  $("description").value = coaching.description || "";
  $("founderName").value = coaching.founder_name || "";
  $("designation").value = coaching.founder_designation || "Director";
  $("phone").value = coaching.phone || "";
  $("contactEmail").value = coaching.email || "";
  $("address").value = coaching.address || "";

  if(coaching.logo_url){
    $("logoPreview").src = coaching.logo_url;
    $("logoPreview").classList.remove("hidden");
  }
  if(coaching.founder_photo_url){
    $("founderPreview").src = coaching.founder_photo_url;
    $("founderPreview").classList.remove("hidden");
  }

  updatePublicLink();
  await loadBatches();
}

async function uploadImage(file, folder){
  if(!file) return null;
  const ext = file.name.split(".").pop();
  const path = `${user.id}/${folder}-${Date.now()}.${ext}`;
  const {error} = await sb.storage.from("coaching-images").upload(path,file,{upsert:true});
  if(error) throw error;
  const {data} = sb.storage.from("coaching-images").getPublicUrl(path);
  return data.publicUrl;
}

$("logoFile").addEventListener("change", e => {
  const f=e.target.files[0]; if(!f)return;
  $("logoPreview").src=URL.createObjectURL(f); $("logoPreview").classList.remove("hidden");
});
$("founderFile").addEventListener("change", e => {
  const f=e.target.files[0]; if(!f)return;
  $("founderPreview").src=URL.createObjectURL(f); $("founderPreview").classList.remove("hidden");
});

$("coachingForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if(!user) return;

  $("saveMessage").textContent = "Saving...";

  try{
    let logoUrl = coaching?.logo_url || null;
    let founderUrl = coaching?.founder_photo_url || null;

    if($("logoFile").files[0]) logoUrl = await uploadImage($("logoFile").files[0],"logo");
    if($("founderFile").files[0]) founderUrl = await uploadImage($("founderFile").files[0],"founder");

    const payload = {
      owner_id:user.id,
      coaching_name:$("coachingName").value.trim(),
      slug:slugify($("slug").value),
      description:$("description").value.trim(),
      logo_url:logoUrl,
      founder_name:$("founderName").value.trim(),
      founder_designation:$("designation").value.trim(),
      founder_photo_url:founderUrl,
      phone:$("phone").value.trim(),
      email:$("contactEmail").value.trim(),
      address:$("address").value.trim()
    };

    if(!payload.coaching_name || !payload.slug) throw new Error("Coaching Name और Unique Page Name जरूरी है।");

    const {data,error} = await sb.from("coachings")
      .upsert(payload,{onConflict:"owner_id"})
      .select()
      .single();

    if(error) throw error;

    coaching=data;
    $("saveMessage").textContent="✅ Coaching Page successfully generated!";
    updatePublicLink();
    await loadBatches();
  }catch(err){
    $("saveMessage").textContent="❌ "+err.message;
  }
});

function updatePublicLink(){
  if(!coaching) return;
  const base = new URL("./", window.location.href);
  const link = base.origin + base.pathname + "public.html?slug=" + encodeURIComponent(coaching.slug);
  $("publicLink").value = link;
  $("linkBox").classList.remove("hidden");
}

async function copyPublicLink(){
  await navigator.clipboard.writeText($("publicLink").value);
  alert("Link Copied!");
}

function openPublicLink(){
  window.location.href = $("publicLink").value;
}

async function loadBatches(){
  if(!coaching) return;
  const {data,error}=await sb.from("batches").select("*").eq("coaching_id",coaching.id).order("created_at",{ascending:false});
  if(error){console.error(error);return;}

  $("batchList").innerHTML=(data||[]).map(b=>`
    <div class="batch-item">
      <div><b>${escapeHtml(b.batch_name)}</b><br><span>${escapeHtml(b.description||"")}</span></div>
      <button class="danger" onclick="deleteBatch('${b.id}')">Delete</button>
    </div>`).join("") || "<p>No batches added yet.</p>";
}

async function addBatch(){
  if(!coaching){alert("पहले Coaching Information Save करें।");return;}
  const name=$("batchName").value.trim();
  const description=$("batchDescription").value.trim();
  if(!name){alert("Batch Name लिखें।");return;}

  const {error}=await sb.from("batches").insert({coaching_id:coaching.id,batch_name:name,description});
  if(error){alert(error.message);return;}
  $("batchName").value=""; $("batchDescription").value="";
  await loadBatches();
}

async function deleteBatch(id){
  await sb.from("batches").delete().eq("id",id);
  await loadBatches();
}

function escapeHtml(v=""){
  const d=document.createElement("div"); d.textContent=v; return d.innerHTML;
}

(async function init(){
  const {data:{session}}=await sb.auth.getSession();
  user=session?.user||null;
  updateNav();
  showPage("home");
})();