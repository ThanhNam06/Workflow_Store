export async function apiGet(path){ return fetch(path).then(r=>r.json()).catch(()=>[]) }
