const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
let authMode='login',currentUser=null,currentCoaching=null;

const $=id=>document.getElementById(id);
const escapeHtml=s=>{const d=document.createElement('div');d.textContent=s||'';return d.innerHTML};

function showPage(name){
  ['homePage','authPage','dashboardPage','publicPage'].forEach(x=>$(x).classList.add('hidden'));
  $(name+'Page').classList.remove('hidden');
  window.scrollTo(0,0);
}

function setAuthMode(mode){
  authMode=mode;
  $('loginTab').classList.toggle('active',mode==='login');
  $('registerTab').classList.toggle('active',mode==='register');
  $('authTitle').textContent=mode==='login'?'अपने account में Login करें':'नई Coaching के लिए Account बनाएं';
  $('authButton').textContent=mode==='login'?'Login':'Create Account';
  $('authMessage').textContent='';
}

function getPublicSlug(){
  const m=location.hash.match(/^#\/c\/([^/?#]+)/);
  return m?decodeURIComponent(m[1]):null;
}

function updateGeneratedLink(){
  if(!currentCoaching)return;
  const base=location.origin+location.pathname;
  $('publicLink').value=base+'#/c/'+encodeURIComponent(currentCoaching.slug);
  $('generatedBox').classList.remove('hidden');
}

async function init(){
  const {data:{session}}=await supabaseClient.auth.getSession();
  currentUser=session?.user||null;
  updateNav();
  const slug=getPublicSlug();
  if(slug)loadPublicPage(slug);
}

function updateNav(){
  $('loginNav').classList.toggle('hidden',!!currentUser);
  $('dashboardNav').classList.toggle('hidden',!currentUser);
  $('logoutNav').classList.toggle('hidden',!currentUser);
}

$('authForm').addEventListener('submit',async e=>{
  e.preventDefault();

  const email=$('authEmail').value.trim();
  const password=$('authPassword').value;

  $('authMessage').textContent='Please wait...';

  const r=authMode==='register'
    ?await supabaseClient.auth.signUp({email,password})
    :await supabaseClient.auth.signInWithPassword({email,password});

  if(r.error){
    $('authMessage').textContent='❌ '+r.error.message;
    return;
  }

  if(authMode==='register'&&!r.data.session){
    $('authMessage').textContent='✅ Account created! Email confirmation के बाद Login करें।';
    return;
  }

  currentUser=r.data.user||r.data.session?.user;
  updateNav();
  openDashboard();
});

async function logout(){
  await supabaseClient.auth.signOut();
  currentUser=null;
  currentCoaching=null;
  updateNav();
  showPage('home');
}

async function openDashboard(){
  if(!currentUser){
    showPage('auth');
    return;
  }

  if(location.hash.startsWith('#/c/')){
    history.replaceState(null,'',location.pathname);
  }

  showPage('dashboard');

  const {data}=await supabaseClient
    .from('coachings')
    .select('*')
    .eq('owner_id',currentUser.id)
    .maybeSingle();

  currentCoaching=data||null;

  if(data){
    $('coachingName').value=data.coaching_name||'';
    $('slug').value=data.slug||'';
    $('description').value=data.description||'';
    $('founderName').value=data.founder_name||'';
    $('founderDesignation').value=data.founder_designation||'Director';
    $('phone').value=data.phone||'';
    $('contactEmail').value=data.email||'';
    $('address').value=data.address||'';

    if(data.logo_url){
      $('logoPreview').src=data.logo_url;
      $('logoPreview').classList.remove('hidden');
    }

    if(data.founder_photo_url){
      $('founderPreview').src=data.founder_photo_url;
      $('founderPreview').classList.remove('hidden');
    }

    updateGeneratedLink();
    loadBatches();
  }else{
    $('generatedBox').classList.add('hidden');
    $('batchList').innerHTML='पहले Coaching को Save करें।';
  }
}

$('logoFile').addEventListener('change',e=>preview(e,'logoPreview'));
$('founderFile').addEventListener('change',e=>preview(e,'founderPreview'));

function preview(e,id){
  const f=e.target.files[0];

  if(f){
    $(id).src=URL.createObjectURL(f);
    $(id).classList.remove('hidden');
  }
}

async function uploadImage(file,folder){
  if(!file)return null;

  const ext=file.name.split('.').pop();
  const path=`${currentUser.id}/${folder}-${Date.now()}.${ext}`;

  const {error}=await supabaseClient
    .storage
    .from('coaching-images')
    .upload(path,file,{upsert:true});

  if(error)throw error;

  return supabaseClient
    .storage
    .from('coaching-images')
    .getPublicUrl(path).data.publicUrl;
}

$('coachingForm').addEventListener('submit',async e=>{
  e.preventDefault();

  try{
    $('saveMessage').textContent='Saving...';

    let logo=currentCoaching?.logo_url||null;
    let founderPhoto=currentCoaching?.founder_photo_url||null;

    if($('logoFile').files[0]){
      logo=await uploadImage($('logoFile').files[0],'logo');
    }

    if($('founderFile').files[0]){
      founderPhoto=await uploadImage($('founderFile').files[0],'founder');
    }

    const slug=$('slug').value.trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g,'-')
      .replace(/-+/g,'-')
      .replace(/^-|-$/g,'');

    const payload={
      owner_id:currentUser.id,
      coaching_name:$('coachingName').value.trim(),
      slug,
      description:$('description').value.trim(),
      logo_url:logo,
      address:$('address').value.trim(),
      phone:$('phone').value.trim(),
      email:$('contactEmail').value.trim(),
      founder_name:$('founderName').value.trim(),
      founder_designation:$('founderDesignation').value.trim()||'Director',
      founder_photo_url:founderPhoto,
      updated_at:new Date().toISOString()
    };

    const r=currentCoaching
      ?await supabaseClient.from('coachings').update(payload).eq('id',currentCoaching.id).select().single()
      :await supabaseClient.from('coachings').insert(payload).select().single();

    if(r.error)throw r.error;

    currentCoaching=r.data;

    $('saveMessage').textContent='✅ Saved successfully! आपका page link तैयार है।';

    updateGeneratedLink();
    loadBatches();

  }catch(err){
    $('saveMessage').textContent='❌ '+err.message;
  }
});

async function loadBatches(){
  if(!currentCoaching)return;

  const {data,error}=await supabaseClient
    .from('batches')
    .select('*')
    .eq('coaching_id',currentCoaching.id)
    .order('created_at',{ascending:false});

  if(error){
    $('batchList').textContent=error.message;
    return;
  }

  $('batchList').innerHTML=(data||[]).map(b=>`
    <div class="batch-item">
      <div>
        <b>${escapeHtml(b.batch_name)}</b>
        <small>${escapeHtml(b.description||'')}</small>
      </div>
      <button onclick="deleteBatch('${b.id}')">🗑️</button>
    </div>
  `).join('')||'<p>अभी कोई Batch नहीं जोड़ा गया।</p>';
}

async function addBatch(){
  const name=$('batchName').value.trim();
  const description=$('batchDescription').value.trim();

  if(!currentCoaching){
    alert('पहले Coaching Save करें।');
    return;
  }

  if(!name)return;

  const {error}=await supabaseClient
    .from('batches')
    .insert({
      coaching_id:currentCoaching.id,
      batch_name:name,
      description
    });

  if(error){
    alert(error.message);
    return;
  }

  $('batchName').value='';
  $('batchDescription').value='';

  loadBatches();
}

async function deleteBatch(id){
  if(confirm('Delete this batch?')){
    await supabaseClient
      .from('batches')
      .delete()
      .eq('id',id);

    loadBatches();
  }
}

function copyPublicLink(){
  navigator.clipboard.writeText($('publicLink').value);
  alert('✅ Link copied!');
}

function openPublicPage(){
  location.href=$('publicLink').value;
}

async function loadPublicPage(slug){
  showPage('public');

  const {data:c,error}=await supabaseClient
    .from('coachings')
    .select('*')
    .eq('slug',slug)
    .single();

  if(error||!c){
    $('publicContent').innerHTML=`
      <div class="notfound">
        <h1>Page Not Found</h1>
        <p>यह Coaching Page उपलब्ध नहीं है।</p>
      </div>
    `;
    return;
  }

  const {data:batches=[]}=await supabaseClient
    .from('batches')
    .select('*')
    .eq('coaching_id',c.id)
    .order('created_at',{ascending:false});

  $('publicContent').innerHTML=`
    <div class="public-hero">

      ${c.logo_url
        ?`<img class="public-logo" src="${c.logo_url}">`
        :'<div class="public-logo placeholder">🎓</div>'}

      <div>
        <h1>${escapeHtml(c.coaching_name)}</h1>
        <p>${escapeHtml(c.description||'Welcome to our Coaching Institute')}</p>
      </div>

    </div>

    <div class="public-grid">

      <section class="public-card">
        <h2>📚 Current Batches</h2>

        ${batches.length
          ?batches.map(b=>`
            <div class="public-batch">
              <b>${escapeHtml(b.batch_name)}</b>
              <p>${escapeHtml(b.description||'')}</p>
            </div>
          `).join('')
          :'<p>Current batches जल्द उपलब्ध होंगे।</p>'}

      </section>

      <section class="public-card founder">

        ${c.founder_photo_url
          ?`<img src="${c.founder_photo_url}" class="founder-photo">`
          :''}

        <div>
          <h2>👨‍🏫 ${escapeHtml(c.founder_designation||'Director')}</h2>
          <h3>${escapeHtml(c.founder_name||'')}</h3>
          <p>Founder / Director</p>
        </div>

      </section>

      <section class="public-card contact">
        <h2>📞 Contact Details</h2>

        <p>📍 ${escapeHtml(c.address||'Address उपलब्ध नहीं')}</p>
        <p>📱 ${escapeHtml(c.phone||'')}</p>
        <p>✉️ ${escapeHtml(c.email||'')}</p>

      </section>

    </div>

    <a class="student-btn" href="https://portal.greatindia.technology/">
      🎓 STUDENT LOGIN / REGISTER
    </a>
  `;
}

window.addEventListener('hashchange',()=>{
  const slug=getPublicSlug();

  if(slug){
    loadPublicPage(slug);
  }
});

init();

window.showPage = showPage;
window.setAuthMode = setAuthMode;
window.openDashboard = openDashboard;
window.logout = logout;
window.addBatch = addBatch;
window.deleteBatch = deleteBatch;
window.copyPublicLink = copyPublicLink;
window.openPublicPage = openPublicPage;
function show(page){
  if(page==='home') showPage('home');
  if(page==='auth') showPage('auth');
}

function dashboard(){
  openDashboard();
}

function mode(type){
  setAuthMode(type);
}

function copyLink(){
  copyPublicLink();
}

function openLink(){
  openPublicPage();
}

window.show = show;
window.dashboard = dashboard;
window.mode = mode;
window.copyLink = copyLink;
window.openLink = openLink;
