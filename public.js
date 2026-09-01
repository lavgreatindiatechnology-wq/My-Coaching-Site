/* Public page runtime — part of the My Coaching Site platform. */
const sbPublic = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const $p = (id) => document.getElementById(id);

function escapePublic(v=""){
  const d=document.createElement("div"); d.textContent=v; return d.innerHTML;
}

async function loadPublicPage(){
  const slug = new URLSearchParams(location.search).get("slug");

  if(!slug){
    $p("loading").textContent="Coaching Page Not Found";
    return;
  }

  const {data:coaching,error}=await sbPublic.from("coachings").select("*").eq("slug",slug).maybeSingle();

  if(error || !coaching){
    $p("loading").textContent="Coaching Page Not Found";
    return;
  }

  document.title = coaching.coaching_name + " | Coaching";
  $p("topName").textContent=coaching.coaching_name;
  $p("coachingName").textContent=coaching.coaching_name;
  $p("description").textContent=coaching.description||"";
  $p("aboutText").textContent=coaching.description||"Quality education and guidance for students.";
  $p("founderName").textContent=coaching.founder_name||"Founder";
  $p("designation").textContent=coaching.founder_designation||"Director";
  $p("phone").textContent=coaching.phone||"Not available";
  $p("email").textContent=coaching.email||"Not available";
  $p("address").textContent=coaching.address||"Not available";
  $p("footerName").textContent=coaching.coaching_name;
  $p("year").textContent=new Date().getFullYear();

  if(coaching.logo_url){
    $p("logo").src=coaching.logo_url;
    $p("logo").classList.remove("hidden");
    $p("logoIcon").classList.add("hidden");
  }

  if(coaching.founder_photo_url){
    $p("founderPhoto").src=coaching.founder_photo_url;
    $p("founderPhoto").classList.remove("hidden");
  }

  const {data:batches=[]}=await sbPublic.from("batches")
    .select("*")
    .eq("coaching_id",coaching.id)
    .order("created_at",{ascending:false});

  $p("batches").innerHTML=batches.length
    ? batches.map(b=>`<div class="public-batch"><div class="batch-icon">📖</div><div><h3>${escapePublic(b.batch_name)}</h3><p>${escapePublic(b.description||"Admission Open")}</p></div></div>`).join("")
    : "<p>Current batches जल्द उपलब्ध होंगे।</p>";

  $p("loading").classList.add("hidden");
  $p("site").classList.remove("hidden");
}

loadPublicPage();