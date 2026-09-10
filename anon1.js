const { H, waitFor } = require('./lib3.js');
module.exports = async (api) => {
  await api.nav('http://localhost:5174/');
  await waitFor(api, `document.body.textContent.length > 100`, 'carga', 90);
  if (await api.evalJS(`return /Ingrese sus credenciales/i.test(document.body.textContent);`)) {
    await api.evalJS(`
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
      const ins = Array.from(document.querySelectorAll('input'));
      const u = ins.find(i=>i.type==='text'||i.type===''), p = ins.find(i=>i.type==='password');
      setter.call(u,'admin'); u.dispatchEvent(new Event('input',{bubbles:true}));
      setter.call(p,'admin'); p.dispatchEvent(new Event('input',{bubbles:true}));
      Array.from(document.querySelectorAll('button')).find(b=>/ingresar/i.test(b.textContent)).click(); return 1;`);
  }
  await waitFor(api, "byText(/^Solicitudes$/)", 'menu');
  await api.evalJS(H + " byText(/^Solicitudes$/).click(); return 1;");
  await waitFor(api, "byText(/Lista de Solicitudes/)", 'subnav');
  await api.evalJS(H + " byText(/Lista de Solicitudes/).click(); return 1;");
  await waitFor(api, `document.querySelectorAll('table tbody tr').length > 2`, 'lista', 60);
  await api.evalJS(H + `
    const tr = Array.from(document.querySelectorAll('table tbody tr')).find(x=>txt(x).indexOf('BAN-DIGITAL-20260826-000002')>=0);
    Array.from(tr.querySelectorAll('a,button')).find(x=>/^Editar$/i.test(txt(x))).click(); return 1;`);
  await waitFor(api, `document.body.textContent.indexOf('Edición Solicitud') >= 0`, 'form', 60);
  await api.sleep(4000);
  await api.evalJS(H + " return abrirAcordeon('Votación CPC','PANEL DE VOTACIÓN COLEGIADA');");
  await api.sleep(4000);

  const etiqueta = await api.evalJS(`
    const t = document.body.textContent;
    const i = t.indexOf('Identidad (anónima)');
    return i>=0 ? t.slice(i, i+60).replace(/\s+/g,' ') : '(no visible)';`);
  console.log('PERFIL A - etiqueta asignada:', etiqueta);

  // Votar
  await api.evalJS(`
    const setT = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set;
    const radios = Array.from(document.querySelectorAll('input[type=radio]'));
    radios[0].click();
    const ta = Array.from(document.querySelectorAll('textarea')).find(t=>(t.placeholder||'').indexOf('Fundamente')>=0);
    setT.call(ta, 'Primer miembro del comité evalúa la estructura y comisiones propuestas y considera que la operación cumple los parámetros de riesgo aceptables para su aprobación.');
    ta.dispatchEvent(new Event('input',{bubbles:true}));
    return 1;`);
  await api.sleep(1500);
  await api.evalJS(H + " const b = byText(/Registrar Voto en Plataforma/i); if (b) b.click(); return !!b;");
  await api.sleep(2500);
  console.log('toast:', await api.evalJS(`
    const t=document.body.textContent; const i=t.indexOf('Voto registrado');
    return i>=0 ? t.slice(i,i+90) : '(no se registró)';`));
  await api.shot('AA1-perfilA');
};
