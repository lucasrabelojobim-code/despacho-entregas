'use strict';
/* utilidades gerais */
function $(s,r){return (r||document).querySelector(s);}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function pad(n){return String(n).padStart(2,'0');}
function hhmm(iso){if(!iso)return '—';var d=new Date(iso);return pad(d.getHours())+':'+pad(d.getMinutes());}
function ddmm(d){d=new Date(d);return pad(d.getDate())+'/'+pad(d.getMonth()+1);}
function dayKey(d){d=new Date(d);return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());}
function todayKey(){return dayKey(new Date());}
function mins(a,b){return Math.round((new Date(b)-new Date(a))/60000);}
function fmtDur(m){if(m==null)return '—';return m<60?m+' min':Math.floor(m/60)+'h'+pad(m%60);}
function pct(a,b){return b?Math.round(a*100/b):null;}
function fmtPct(v){return v==null?'—':v+'%';}
function sum(a){return a.reduce(function(x,y){return x+y;},0);}
function nowIso(){return new Date().toISOString();}
function fmtLong(d){return d.toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long'});}
function fv(f,n){var el=f.elements.namedItem(n);return el&&el.value!=null?el.value:'';}
function fres(f){var c=f.querySelector('input[name=res]:checked');return c?c.value:'';}
function opts(list,val){return list.map(function(o){return '<option value="'+esc(o[0])+'"'+(String(o[0])===String(val)?' selected':'')+'>'+esc(o[1])+'</option>';}).join('');}
