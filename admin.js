/* Admin panel for My Coaching Site */
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const $ = id => document.getElementById(id);
let adminUser=null, allCoachings=[];

async function isAdmin(){
  if(!adminUser) return false;
  const {data,error}=await sb.from('admin_users').select('user_id').eq('user_id',adminUser.id).maybeSingle();
  return !!data && !error;
}
function esc(v=''){const d=document.createElement('div');d.textContent=v??'';return d.innerHTML}
function publicUrl(slug){const u=new URL('./public.html',window.location.href);u.searchParams.set('slug',slug);return u.href}

$('adminLoginForm').addEventListener('submit',async e=>{
 e.preventDefault(); $('loginMsg').textContent='Logging in...';
 const {data,error}=await sb.auth.signInWithPassword({email:$('adminEmail').value.trim(),password:$('adminPassword').value});
 if(error){$('loginMsg').textContent='❌ '+error.message;return}
 adminUser=data.user;
 if(!(await isAdmin())){await sb.auth.signOut();adminUser=null;$('loginMsg').textContent='❌ यह account Admin के रूप में authorized नहीं है।';return}
 $('loginBox').classList.add('hidden');$('panel').classList.remove('hidden');loadAll();
});

async function loadAll(){
 $('status').textContent='Loading coaching owners...';
 const [{data:coachings,error},{count:batchesCount}]=await Promise.all([
   sb.from('coachings').select('*').order('created_at',{ascending:false}),
   sb.from('batches').select('*',{count:'exact',head:true})
 ]);
 if(error){$('status').textContent='❌ '+error.message;return}
 allCoachings=coachings||[];$('totalCount').textContent=allCoachings.length;$('batchCount').textContent=batchesCount||0;
 render();$('status').textContent='';
}
function render(){
 const q=$('search').value.toLowerCase().trim();
 const list=allCoachings.filter(c=>[c.coaching_name,c.founder_name,c.email,c.phone].join(' ').toLowerCase().includes(q));
 $('rows').innerHTML=list.map(c=>`<tr><td><div class="name">${esc(c.coaching_name)}</div><div class="muted">/${esc(c.slug)}</div></td><td>${esc(c.founder_name||'-')}<div class="muted">${esc(c.founder_designation||'')}</div></td><td>${esc(c.phone||'-')}<div class="muted">${esc(c.email||'')}</div></td><td><a class="action-btn open" href="${publicUrl(c.slug)}" target="_blank">Open</a></td><td class="muted">${c.created_at?new Date(c.created_at).toLocaleDateString(): '-'}</td><td><button class="action-btn edit" onclick="editCoaching('${c.id}')">Edit</button><button class="action-btn delete" onclick="deleteCoaching('${c.id}','${esc(c.coaching_name).replace(/'/g,'')}')">Delete</button></td></tr>`).join('')||'<tr><td colspan="6">No coaching found.</td></tr>';
}
$('search').addEventListener('input',render);$('refreshBtn').onclick=loadAll;

window.editCoaching=id=>{
 const c=allCoachings.find(x=>x.id===id);if(!c)return;
 $('editId').value=c.id;$('editName').value=c.coaching_name||'';$('editSlug').value=c.slug||'';$('editDescription').value=c.description||'';$('editFounder').value=c.founder_name||'';$('editDesignation').value=c.founder_designation||'';$('editPhone').value=c.phone||'';$('editEmail').value=c.email||'';$('editAddress').value=c.address||'';$('editMsg').textContent='';$('editModal').classList.remove('hidden');
};
$('editForm').addEventListener('submit',async e=>{e.preventDefault();$('editMsg').textContent='Saving...';
 const payload={coaching_name:$('editName').value.trim(),slug:$('editSlug').value.trim().toLowerCase(),description:$('editDescription').value.trim(),founder_name:$('editFounder').value.trim(),founder_designation:$('editDesignation').value.trim(),phone:$('editPhone').value.trim(),email:$('editEmail').value.trim(),address:$('editAddress').value.trim(),updated_at:new Date().toISOString()};
 const {error}=await sb.from('coachings').update(payload).eq('id',$('editId').value);if(error){$('editMsg').textContent='❌ '+error.message;return}$('editMsg').textContent='✅ Saved successfully';await loadAll();setTimeout(()=>$('editModal').classList.add('hidden'),600);
});
window.deleteCoaching=async(id,name)=>{if(!confirm(`क्या आप "${name}" Coaching को permanently delete करना चाहते हैं?`))return;const {error}=await sb.from('coachings').delete().eq('id',id);if(error){alert('❌ '+error.message);return}await loadAll();};
$('closeModal').onclick=$('cancelEdit').onclick=()=>$('editModal').classList.add('hidden');
$('logoutBtn').onclick=async()=>{await sb.auth.signOut();location.reload()};
(async()=>{const {data:{session}}=await sb.auth.getSession();if(session){adminUser=session.user;if(await isAdmin()){$('loginBox').classList.add('hidden');$('panel').classList.remove('hidden');loadAll()}else await sb.auth.signOut();}})();
