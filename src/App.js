import { useState, useEffect } from "react";

const STATUSES = ["Pendiente","En curso","Completado","Atrasado","Cancelado"];
const PRIORITIES = ["Crítica","Alta","Media","Baja"];
const PRIORITY_COLORS = { "Crítica":"#ef4444","Alta":"#f97316","Media":"#3b82f6","Baja":"#10b981" };
const STATUS_COLORS_LIGHT = {
  "Pendiente":  { bg:"#e8f0fe", text:"#1a56db", border:"#93afe8" },
  "En curso":   { bg:"#fef3c7", text:"#92400e", border:"#f59e0b" },
  "Completado": { bg:"#d1fae5", text:"#065f46", border:"#34d399" },
  "Atrasado":   { bg:"#fee2e2", text:"#991b1b", border:"#f87171" },
  "Cancelado":  { bg:"#f3f4f6", text:"#6b7280", border:"#d1d5db" },
};
const STATUS_COLORS_DARK = {
  "Pendiente":  { bg:"#1e3a5f", text:"#93c5fd", border:"#1e40af" },
  "En curso":   { bg:"#4a2e00", text:"#fcd34d", border:"#d97706" },
  "Completado": { bg:"#064e3b", text:"#6ee7b7", border:"#059669" },
  "Atrasado":   { bg:"#4c0519", text:"#fca5a5", border:"#dc2626" },
  "Cancelado":  { bg:"#374151", text:"#9ca3af", border:"#4b5563" },
};

const genId = () => Math.random().toString(36).slice(2,9);
const todayStr = () => new Date().toISOString().split("T")[0];

const DEMO_PROJECTS = [
  {
    id:"p1", name:"Rediseño Web Corporativa", description:"Modernizar el sitio web de la empresa",
    status:"En curso", priority:"Alta", startDate:"2025-01-15", endDate:"2025-06-30",
    assignees:["Ana García","Carlos López"], color:"#6366f1", progress:45,
    subprojects:[
      { id:"sp1", name:"UX Research", status:"Completado", priority:"Alta",
        startDate:"2025-01-15", endDate:"2025-02-28", assignees:["Ana García"], progress:100,
        tasks:[
          { id:"t1", name:"Entrevistas usuarios", status:"Completado", priority:"Alta", startDate:"2025-01-20", endDate:"2025-02-10", assignees:["Ana García"], dependsOn:[], subtasks:[{id:"st1",name:"Guía de preguntas",status:"Completado"},{id:"st2",name:"Transcripciones",status:"Completado"}] },
          { id:"t2", name:"Análisis competencia", status:"Completado", priority:"Media", startDate:"2025-02-01", endDate:"2025-02-28", assignees:["Ana García"], dependsOn:[], subtasks:[] },
        ]
      },
      { id:"sp2", name:"Diseño UI", status:"En curso", priority:"Alta",
        startDate:"2025-03-01", endDate:"2025-04-30", assignees:["Carlos López"], progress:60,
        tasks:[
          { id:"t3", name:"Wireframes", status:"Completado", priority:"Alta", startDate:"2025-03-01", endDate:"2025-03-15", assignees:["Carlos López"], dependsOn:["t1"], subtasks:[] },
          { id:"t4", name:"Prototipos interactivos", status:"En curso", priority:"Alta", startDate:"2025-03-16", endDate:"2025-04-15", assignees:["Carlos López"], dependsOn:["t3"], subtasks:[{id:"st3",name:"Home page",status:"Completado"},{id:"st4",name:"Dashboard",status:"En curso"}] },
        ]
      },
    ]
  },
  {
    id:"p2", name:"App Móvil v2.0", description:"Nueva versión de la aplicación móvil",
    status:"Pendiente", priority:"Crítica", startDate:"2025-04-01", endDate:"2025-09-30",
    assignees:["María Torres","Luis Ramos"], color:"#10b981", progress:10,
    subprojects:[
      { id:"sp3", name:"Backend API", status:"En curso", priority:"Crítica",
        startDate:"2025-04-01", endDate:"2025-06-30", assignees:["Luis Ramos"], progress:20,
        tasks:[
          { id:"t5", name:"Diseño arquitectura", status:"En curso", priority:"Crítica", startDate:"2025-04-01", endDate:"2025-04-30", assignees:["Luis Ramos"], dependsOn:[], subtasks:[] },
          { id:"t6", name:"Autenticación OAuth", status:"Pendiente", priority:"Alta", startDate:"2025-05-01", endDate:"2025-05-31", assignees:["Luis Ramos"], dependsOn:["t5"], subtasks:[] },
        ]
      },
    ]
  },
];

// ─── Storage helpers ───────────────────────────────────────────────────────────
async function saveData(projects) {
  try { await window.storage.set("pf_projects", JSON.stringify(projects)); } catch(_) {}
}

// ─── Auto-atrasado ─────────────────────────────────────────────────────────────
function autoMarkLate(projects) {
  const now = todayStr();
  return projects.map(p => ({
    ...p,
    status: p.endDate < now && !["Completado","Cancelado"].includes(p.status) ? "Atrasado" : p.status,
    subprojects: (p.subprojects||[]).map(sp => ({
      ...sp,
      status: sp.endDate < now && !["Completado","Cancelado"].includes(sp.status) ? "Atrasado" : sp.status,
      tasks: (sp.tasks||[]).map(t => ({
        ...t,
        status: t.endDate < now && !["Completado","Cancelado"].includes(t.status) ? "Atrasado" : t.status,
      }))
    }))
  }));
}

// ─── Flatten all items ─────────────────────────────────────────────────────────
function flatItems(projects) {
  const items = [];
  projects.forEach(p => {
    items.push({...p, _type:"project"});
    (p.subprojects||[]).forEach(sp => {
      items.push({...sp, _type:"subproject", _projectId:p.id, _projectName:p.name});
      (sp.tasks||[]).forEach(t => {
        items.push({...t, _type:"task", _projectId:p.id, _projectName:p.name, _spId:sp.id, _spName:sp.name});
      });
    });
  });
  return items;
}

// ─── Progress calc ─────────────────────────────────────────────────────────────
function calcProgress(tasks=[]) {
  if(!tasks.length) return 0;
  const done = tasks.filter(t=>t.status==="Completado").length;
  return Math.round((done/tasks.length)*100);
}

export default function App() {
  const [dark, setDark] = useState(false);
  const [projects, setProjects] = useState(null);
  const [activeView, setActiveView] = useState("dashboard");
  const [modal, setModal] = useState(null);
  const [dragging, setDragging] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const [filterStatus, setFilterStatus] = useState("Todos");
  const [filterPriority, setFilterPriority] = useState("Todos");
  const [notifications, setNotifications] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [saving, setSaving] = useState(false);

  // Load on mount — force Pocamolé as the seed data
  useEffect(() => {
    const updated = autoMarkLate(DEMO_PROJECTS);
    setProjects(updated);
    saveData(updated);
    const notes = [];
    flatItems(updated).forEach(item => {
      if(item.status==="Atrasado") notes.push({id:genId(), type:"late", text:`"${item.name}" está atrasado`, color:"#ef4444"});
    });
    setNotifications(notes);
  }, []);

  // Save whenever projects change
  useEffect(() => {
    if(!projects) return;
    setSaving(true);
    saveData(projects).finally(()=>setSaving(false));
  }, [projects]);

  const sc = dark ? STATUS_COLORS_DARK : STATUS_COLORS_LIGHT;
  const th = {
    bg: dark?"#0f172a":"#f8fafc", surface:dark?"#1e293b":"#ffffff",
    surface2:dark?"#263347":"#f1f5f9", border:dark?"#334155":"#e2e8f0",
    text:dark?"#f1f5f9":"#0f172a", text2:dark?"#94a3b8":"#64748b",
    accent:"#6366f1",
  };

  const s = {
    input: { width:"100%", padding:"8px 10px", borderRadius:8, border:`1px solid ${th.border}`,
      background:th.surface2, color:th.text, fontSize:13, boxSizing:"border-box", outline:"none" },
    btn: (active,color) => ({ padding:"6px 14px", borderRadius:8,
      border:`1px solid ${active?(color||"#6366f1"):th.border}`,
      background:active?(color||"#6366f1"):"transparent", color:active?"#fff":th.text,
      cursor:"pointer", fontSize:13, fontWeight:500 }),
    iconBtn: { background:"transparent", border:`1px solid ${th.border}`, borderRadius:8,
      padding:"6px 10px", cursor:"pointer", color:th.text, fontSize:13 },
    tag: (status) => ({ display:"inline-block", padding:"2px 8px", borderRadius:20, fontSize:11,
      background:sc[status]?.bg||"#f3f4f6", color:sc[status]?.text||"#6b7280",
      border:`1px solid ${sc[status]?.border||"#d1d5db"}`, fontWeight:600 }),
    prio: (p) => ({ display:"inline-block", padding:"2px 8px", borderRadius:20, fontSize:11,
      background:(PRIORITY_COLORS[p]||"#888")+"22", color:PRIORITY_COLORS[p]||"#888", fontWeight:600 }),
  };

  function updateProjects(fn) { setProjects(prev => autoMarkLate(fn(prev))); }

  function updateItemStatus(id, newStatus, type) {
    updateProjects(prev => prev.map(p => {
      if(type==="project"&&p.id===id) return {...p,status:newStatus};
      return {...p, subprojects:(p.subprojects||[]).map(sp=>{
        if(type==="subproject"&&sp.id===id) return {...sp,status:newStatus};
        return {...sp, tasks:(sp.tasks||[]).map(t=> type==="task"&&t.id===id?{...t,status:newStatus}:t)};
      })};
    }));
  }

  function saveItem(data) {
    if(!data) return;
    updateProjects(prev => {
      if(data._isNew) {
        if(data._type==="project") {
          return [...prev, {id:genId(),name:data.name,description:data.description||"",
            status:data.status,priority:data.priority,startDate:data.startDate,endDate:data.endDate,
            assignees:data.assignees||[],color:data.color||"#6366f1",progress:0,subprojects:[]}];
        }
        if(data._type==="subproject") {
          return prev.map(p=> p.id!==data._projectId?p:{...p,subprojects:[...(p.subprojects||[]),
            {id:genId(),name:data.name,status:data.status,priority:data.priority,
             startDate:data.startDate,endDate:data.endDate,assignees:data.assignees||[],progress:0,tasks:[]}]});
        }
        if(data._type==="task") {
          return prev.map(p=> p.id!==data._projectId?p:{...p,subprojects:(p.subprojects||[]).map(sp=>
            sp.id!==data._spId?sp:{...sp,tasks:[...(sp.tasks||[]),
              {id:genId(),name:data.name,status:data.status,priority:data.priority,
               startDate:data.startDate,endDate:data.endDate,assignees:data.assignees||[],
               dependsOn:data.dependsOn||[],subtasks:data.subtasks||[]}]})});
        }
      } else {
        return prev.map(p=>{
          if(data._type==="project"&&p.id===data.id) return {...p,...data};
          return {...p,subprojects:(p.subprojects||[]).map(sp=>{
            if(data._type==="subproject"&&sp.id===data.id) return {...sp,...data};
            return {...sp,tasks:(sp.tasks||[]).map(t=> data._type==="task"&&t.id===data.id?{...t,...data}:t)};
          })};
        });
      }
    });
    setModal(null);
  }

  function deleteItem(id,type) {
    updateProjects(prev=>{
      if(type==="project") return prev.filter(p=>p.id!==id);
      return prev.map(p=>({...p,subprojects:
        type==="subproject"?(p.subprojects||[]).filter(sp=>sp.id!==id):
        (p.subprojects||[]).map(sp=>({...sp,tasks:(sp.tasks||[]).filter(t=>t.id!==id)}))
      }));
    });
    setModal(null);
  }

  if(!projects) return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",
      background:th.bg,color:th.text2,fontSize:14}}>Cargando ProjectFlow...</div>
  );

  const allItems = flatItems(projects);
  const filtered = allItems.filter(i=>
    (filterStatus==="Todos"||i.status===filterStatus)&&
    (filterPriority==="Todos"||i.priority===filterPriority)&&
    (!selectedProject||i._projectId===selectedProject||i.id===selectedProject)
  );
  const byStatus = {};
  STATUSES.forEach(st=>{byStatus[st]=filtered.filter(i=>i.status===st);});

  // Metrics
  const total = allItems.length;
  const done = allItems.filter(i=>i.status==="Completado").length;
  const late = allItems.filter(i=>i.status==="Atrasado").length;
  const ongoing = allItems.filter(i=>i.status==="En curso").length;
  const globalProgress = total?Math.round((done/total)*100):0;

  return (
    <div style={{minHeight:"100vh",background:th.bg,color:th.text,fontFamily:"system-ui,sans-serif",fontSize:14}}>
      {/* NAV */}
      <nav style={{background:th.surface,borderBottom:`1px solid ${th.border}`,padding:"0 16px",
        display:"flex",alignItems:"center",gap:10,height:54,position:"sticky",top:0,zIndex:50}}>
        <span style={{fontWeight:800,fontSize:17,color:"#6366f1",marginRight:4}}>✦ ProjectFlow</span>
        {saving&&<span style={{fontSize:11,color:th.text2}}>Guardando...</span>}
        <div style={{display:"flex",gap:4,marginLeft:8}}>
          {[["dashboard","Panel"],["kanban","Kanban"],["gantt","Gantt"],["lista","Lista"]].map(([v,l])=>(
            <button key={v} style={s.btn(activeView===v)} onClick={()=>setActiveView(v)}>{l}</button>
          ))}
        </div>
        <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:8}}>
          {notifications.length>0&&(
            <span style={{background:"#ef4444",color:"#fff",borderRadius:20,padding:"2px 8px",fontSize:11,fontWeight:700}}>
              {notifications.length} alertas
            </span>
          )}
          <button style={s.iconBtn} onClick={()=>setDark(d=>!d)}>{dark?"☀":"🌙"}</button>
          <button style={{...s.btn(true),background:"#6366f1",color:"#fff",border:"none"}}
            onClick={()=>setModal({_isNew:true,_type:"project",name:"",description:"",status:"Pendiente",
              priority:"Media",startDate:todayStr(),endDate:todayStr(),assignees:[],color:"#6366f1"})}>
            + Nuevo proyecto
          </button>
        </div>
      </nav>

      <div style={{display:"flex",height:"calc(100vh - 54px)"}}>
        {/* SIDEBAR */}
        <aside style={{width:220,background:th.surface,borderRight:`1px solid ${th.border}`,
          overflowY:"auto",padding:10,flexShrink:0}}>
          <div style={{fontSize:11,fontWeight:700,color:th.text2,textTransform:"uppercase",
            letterSpacing:1,marginBottom:8,paddingLeft:4}}>Proyectos</div>
          <div style={{marginBottom:4,padding:"5px 8px",borderRadius:8,cursor:"pointer",
            background:!selectedProject?"#6366f122":"transparent",color:!selectedProject?"#6366f1":th.text,
            fontSize:13,fontWeight:500}} onClick={()=>setSelectedProject(null)}>Todos</div>
          {projects.map(p=>(
            <div key={p.id} style={{padding:"5px 8px",borderRadius:8,cursor:"pointer",
              background:selectedProject===p.id?"#6366f122":"transparent",marginBottom:2,
              display:"flex",alignItems:"center",gap:6}}
              onClick={()=>setSelectedProject(selectedProject===p.id?null:p.id)}>
              <span style={{width:8,height:8,borderRadius:"50%",background:p.color,flexShrink:0}}/>
              <span style={{fontSize:13,color:th.text,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</span>
            </div>
          ))}

          <div style={{marginTop:14,borderTop:`1px solid ${th.border}`,paddingTop:10}}>
            <div style={{fontSize:11,fontWeight:700,color:th.text2,textTransform:"uppercase",letterSpacing:1,marginBottom:8,paddingLeft:4}}>Filtros</div>
            <div style={{fontSize:11,color:th.text2,marginBottom:3,paddingLeft:2}}>Estado</div>
            <select style={{...s.input,marginBottom:8,padding:"5px 8px"}} value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}>
              <option>Todos</option>{STATUSES.map(s=><option key={s}>{s}</option>)}
            </select>
            <div style={{fontSize:11,color:th.text2,marginBottom:3,paddingLeft:2}}>Prioridad</div>
            <select style={{...s.input,padding:"5px 8px"}} value={filterPriority} onChange={e=>setFilterPriority(e.target.value)}>
              <option>Todos</option>{PRIORITIES.map(p=><option key={p}>{p}</option>)}
            </select>
          </div>

          {/* Notifications */}
          {notifications.length>0&&(
            <div style={{marginTop:14,borderTop:`1px solid ${th.border}`,paddingTop:10}}>
              <div style={{fontSize:11,fontWeight:700,color:"#ef4444",textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Alertas</div>
              {notifications.slice(0,4).map(n=>(
                <div key={n.id} style={{fontSize:11,color:"#ef4444",padding:"4px 6px",
                  background:"#fee2e220",borderRadius:6,marginBottom:4,border:"1px solid #fee2e2"}}>{n.text}</div>
              ))}
            </div>
          )}
        </aside>

        {/* CONTENT */}
        <main style={{flex:1,overflowY:"auto",padding:18}}>
          {activeView==="dashboard"&&(
            <DashboardView projects={projects} th={th} s={s} sc={sc}
              total={total} done={done} late={late} ongoing={ongoing} globalProgress={globalProgress}
              onEdit={(item)=>setModal({...item,_isNew:false})}
              onNew={()=>setModal({_isNew:true,_type:"project",name:"",description:"",status:"Pendiente",
                priority:"Media",startDate:todayStr(),endDate:todayStr(),assignees:[],color:"#6366f1"})} />
          )}
          {activeView==="kanban"&&(
            <KanbanView byStatus={byStatus} sc={sc} th={th} s={s}
              dragging={dragging} dragOver={dragOver}
              onDrag={setDragging} setDragOver={setDragOver}
              onDrop={(id,status,type)=>{updateItemStatus(id,status,type);setDragging(null);setDragOver(null);}}
              onEdit={(item)=>setModal({...item,_isNew:false})}
              onNew={(status)=>setModal({_isNew:true,_type:"task",name:"",status,priority:"Media",
                startDate:todayStr(),endDate:todayStr(),assignees:[],dependsOn:[],subtasks:[],
                _projectId:projects[0]?.id,_spId:projects[0]?.subprojects?.[0]?.id})} />
          )}
          {activeView==="gantt"&&(
            <GanttView items={filtered} th={th} s={s}
              onEdit={(item)=>setModal({...item,_isNew:false})} />
          )}
          {activeView==="lista"&&(
            <ListView projects={projects} th={th} s={s} sc={sc}
              onEdit={(item)=>setModal({...item,_isNew:false})}
              onNew={(type,pid,spid)=>setModal({_isNew:true,_type:type,name:"",status:"Pendiente",
                priority:"Media",startDate:todayStr(),endDate:todayStr(),assignees:[],
                dependsOn:[],subtasks:[],_projectId:pid,_spId:spid})}
              onDelete={deleteItem} calcProgress={calcProgress} />
          )}
        </main>
      </div>

      {modal&&(
        <ItemModal data={modal} th={th} s={s} projects={projects}
          onSave={saveItem} onClose={()=>setModal(null)} onDelete={deleteItem} />
      )}
    </div>
  );
}

// ─── DASHBOARD ─────────────────────────────────────────────────────────────────
function DashboardView({projects,th,s,sc,total,done,late,ongoing,globalProgress,onEdit,onNew}) {
  const metrics = [
    {label:"Total ítems",value:total,color:"#6366f1"},
    {label:"Completados",value:done,color:"#10b981"},
    {label:"En curso",value:ongoing,color:"#f59e0b"},
    {label:"Atrasados",value:late,color:"#ef4444"},
  ];
  return (
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18}}>
        <h2 style={{margin:0,fontSize:16,fontWeight:700,color:th.text}}>Panel general</h2>
        <button style={{...s.btn(true),background:"#6366f1",color:"#fff",border:"none"}} onClick={onNew}>+ Nuevo proyecto</button>
      </div>

      {/* Metrics */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:20}}>
        {metrics.map(m=>(
          <div key={m.label} style={{background:th.surface,border:`1px solid ${th.border}`,borderRadius:12,
            padding:"14px 16px",borderTop:`3px solid ${m.color}`}}>
            <div style={{fontSize:11,color:th.text2,fontWeight:600,marginBottom:6}}>{m.label}</div>
            <div style={{fontSize:26,fontWeight:700,color:m.color}}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* Global progress */}
      <div style={{background:th.surface,border:`1px solid ${th.border}`,borderRadius:12,padding:16,marginBottom:20}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
          <span style={{fontSize:13,fontWeight:600,color:th.text}}>Progreso global</span>
          <span style={{fontSize:13,fontWeight:700,color:"#6366f1"}}>{globalProgress}%</span>
        </div>
        <div style={{background:th.surface2,borderRadius:20,height:10,overflow:"hidden"}}>
          <div style={{width:`${globalProgress}%`,height:"100%",background:"linear-gradient(90deg,#6366f1,#8b5cf6)",
            borderRadius:20,transition:"width .5s"}}/>
        </div>
      </div>

      {/* Projects grid */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:14}}>
        {projects.map(p=>{
          const allTasks = (p.subprojects||[]).flatMap(sp=>sp.tasks||[]);
          const prog = calcProgress(allTasks);
          return (
            <div key={p.id} style={{background:th.surface,border:`1px solid ${th.border}`,borderRadius:12,
              padding:16,cursor:"pointer",borderLeft:`4px solid ${p.color}`}}
              onClick={()=>onEdit({...p,_type:"project"})}>
              <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:8}}>
                <div>
                  <div style={{fontWeight:700,fontSize:14,color:th.text,marginBottom:4}}>{p.name}</div>
                  <div style={{fontSize:12,color:th.text2}}>{p.description}</div>
                </div>
                <span style={s.tag(p.status)}>{p.status}</span>
              </div>
              <div style={{display:"flex",gap:8,marginBottom:10,flexWrap:"wrap"}}>
                <span style={s.prio(p.priority)}>{p.priority}</span>
                <span style={{fontSize:11,color:th.text2}}>📅 {p.endDate}</span>
                <span style={{fontSize:11,color:th.text2}}>👥 {p.assignees?.length||0}</span>
              </div>
              <div style={{background:th.surface2,borderRadius:20,height:6,overflow:"hidden",marginBottom:6}}>
                <div style={{width:`${prog}%`,height:"100%",background:p.color,borderRadius:20,transition:"width .4s"}}/>
              </div>
              <div style={{fontSize:11,color:th.text2,textAlign:"right"}}>{prog}% completado · {allTasks.length} tareas</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── KANBAN ────────────────────────────────────────────────────────────────────
function KanbanView({byStatus,sc,th,s,dragging,dragOver,onDrag,setDragOver,onDrop,onEdit,onNew}) {
  return (
    <div>
      <h2 style={{margin:"0 0 14px",fontSize:16,fontWeight:700,color:th.text}}>Tablero Kanban</h2>
      <div style={{display:"flex",gap:12,overflowX:"auto",paddingBottom:12,alignItems:"flex-start"}}>
        {STATUSES.map(status=>(
          <div key={status} style={{background:th.surface2,borderRadius:12,padding:12,
            minHeight:300,width:215,flexShrink:0,
            border:dragOver===status?`2px dashed #6366f1`:`1px solid ${th.border}`,transition:"border .1s"}}
            onDragOver={e=>{e.preventDefault();setDragOver(status);}}
            onDragLeave={()=>setDragOver(null)}
            onDrop={()=>{if(dragging)onDrop(dragging.id,status,dragging._type);}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
              <span style={s.tag(status)}>{status}</span>
              <span style={{fontSize:11,color:th.text2,background:th.border,borderRadius:20,padding:"1px 7px",fontWeight:600}}>
                {byStatus[status]?.length||0}
              </span>
            </div>
            {(byStatus[status]||[]).map(item=>(
              <KanbanCard key={item.id} item={item} th={th} s={s} onDrag={onDrag} onEdit={onEdit}/>
            ))}
            <button style={{width:"100%",padding:"7px",borderRadius:8,
              border:`1px dashed ${th.border}`,background:"transparent",color:th.text2,
              cursor:"pointer",fontSize:12,marginTop:4}} onClick={()=>onNew(status)}>+ Agregar</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function KanbanCard({item,th,s,onDrag,onEdit}) {
  const typeLabel = {project:"Proyecto",subproject:"Subproyecto",task:"Tarea"}[item._type];
  const subtaskDone = (item.subtasks||[]).filter(st=>st.status==="Completado").length;
  const subtaskTotal = (item.subtasks||[]).length;
  return (
    <div draggable onDragStart={()=>onDrag(item)} onDragEnd={()=>onDrag(null)}
      onClick={()=>onEdit(item)}
      style={{background:th.surface,border:`1px solid ${th.border}`,borderRadius:10,
        padding:11,marginBottom:8,cursor:"grab",
        borderLeft:`3px solid ${PRIORITY_COLORS[item.priority]||"#6366f1"}`}}>
      <div style={{fontSize:10,color:th.text2,marginBottom:3,fontWeight:600}}>{typeLabel}</div>
      <div style={{fontWeight:600,fontSize:13,color:th.text,marginBottom:6,lineHeight:1.4}}>{item.name}</div>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:6}}>
        {item.priority&&<span style={s.prio(item.priority)}>{item.priority}</span>}
      </div>
      {subtaskTotal>0&&(
        <div style={{marginBottom:6}}>
          <div style={{background:th.surface2,borderRadius:20,height:4,overflow:"hidden"}}>
            <div style={{width:`${Math.round((subtaskDone/subtaskTotal)*100)}%`,height:"100%",background:"#6366f1"}}/>
          </div>
          <div style={{fontSize:10,color:th.text2,marginTop:2}}>{subtaskDone}/{subtaskTotal} subtareas</div>
        </div>
      )}
      {item.dependsOn?.length>0&&(
        <div style={{fontSize:10,color:"#f59e0b",marginBottom:4}}>⛓ {item.dependsOn.length} dependencia(s)</div>
      )}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{display:"flex",gap:3}}>
          {(item.assignees||[]).slice(0,3).map((a,i)=>(
            <span key={i} style={{width:22,height:22,borderRadius:"50%",background:"#6366f122",
              color:"#6366f1",fontSize:9,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700}}>
              {a.split(" ").map(w=>w[0]).join("").slice(0,2)}
            </span>
          ))}
        </div>
        {item.endDate&&<span style={{fontSize:10,color:th.text2}}>📅 {item.endDate?.slice(5)}</span>}
      </div>
    </div>
  );
}

// ─── GANTT ─────────────────────────────────────────────────────────────────────
function GanttView({items,th,s,onEdit}) {
  const [scale, setScale] = useState("semana");
  const sorted = [...items].filter(i=>i.startDate&&i.endDate).sort((a,b)=>a.startDate.localeCompare(b.startDate));
  if(!sorted.length) return <div style={{color:th.text2,padding:40,textAlign:"center"}}>No hay ítems con fechas</div>;

  const minDate = sorted.reduce((m,i)=>i.startDate<m?i.startDate:m, sorted[0].startDate);
  const maxDate = sorted.reduce((m,i)=>i.endDate>m?i.endDate:m, sorted[0].endDate);
  const totalDays = Math.max(1,Math.round((new Date(maxDate+"T12:00:00")-new Date(minDate+"T12:00:00"))/(86400000)))+14;
  const pxPerDay = scale==="dia"?24:scale==="semana"?14:5;
  const totalW = totalDays*pxPerDay;
  const todayOffset = Math.round((new Date()-new Date(minDate+"T12:00:00"))/(86400000));

  function dayOff(d){ return Math.max(0,Math.round((new Date(d+"T12:00:00")-new Date(minDate+"T12:00:00"))/(86400000))); }
  function barW(sd,ed){ return Math.max(pxPerDay,(dayOff(ed)-dayOff(sd)+1)*pxPerDay); }

  // Build month/week markers
  const markers = [];
  let cur = new Date(minDate+"T12:00:00");
  const endD = new Date(maxDate+"T12:00:00");
  endD.setDate(endD.getDate()+14);
  while(cur<=endD) {
    const label = scale==="dia"
      ? cur.toLocaleDateString("es-CO",{day:"2-digit",month:"short"})
      : scale==="semana"
      ? `S${Math.ceil(cur.getDate()/7)} ${cur.toLocaleDateString("es-CO",{month:"short"})}`
      : cur.toLocaleDateString("es-CO",{month:"short",year:"2-digit"});
    markers.push({label, offset:dayOff(cur.toISOString().split("T")[0])});
    if(scale==="dia") cur.setDate(cur.getDate()+1);
    else if(scale==="semana") cur.setDate(cur.getDate()+7);
    else cur.setMonth(cur.getMonth()+1);
  }

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
        <h2 style={{margin:0,fontSize:16,fontWeight:700,color:th.text}}>Diagrama Gantt</h2>
        <div style={{display:"flex",gap:4}}>
          {["dia","semana","mes"].map(sc=>(
            <button key={sc} style={s.btn(scale===sc)} onClick={()=>setScale(sc)}>{sc.charAt(0).toUpperCase()+sc.slice(1)}</button>
          ))}
        </div>
      </div>
      <div style={{background:th.surface,border:`1px solid ${th.border}`,borderRadius:12,overflow:"hidden"}}>
        <div style={{display:"flex"}}>
          {/* Labels col */}
          <div style={{width:200,flexShrink:0,borderRight:`1px solid ${th.border}`}}>
            <div style={{height:40,background:th.surface2,borderBottom:`1px solid ${th.border}`,
              padding:"0 12px",display:"flex",alignItems:"center",fontSize:12,fontWeight:600,color:th.text2}}>Ítem</div>
            {sorted.map(item=>(
              <div key={item.id} onClick={()=>onEdit(item)}
                style={{height:46,borderBottom:`1px solid ${th.border}`,padding:"0 10px",
                  display:"flex",alignItems:"center",cursor:"pointer",gap:6}}>
                <span style={{width:8,height:8,borderRadius:"50%",background:PRIORITY_COLORS[item.priority]||"#94a3b8",flexShrink:0}}/>
                <div style={{overflow:"hidden"}}>
                  <div style={{fontSize:12,color:th.text,fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.name}</div>
                  <div style={{fontSize:10,color:th.text2}}>{({project:"Proyecto",subproject:"Subproyecto",task:"Tarea"})[item._type]}</div>
                </div>
              </div>
            ))}
          </div>
          {/* Timeline */}
          <div style={{overflowX:"auto",flex:1}}>
            <div style={{width:totalW,position:"relative",minWidth:"100%"}}>
              {/* Header */}
              <div style={{height:40,background:th.surface2,borderBottom:`1px solid ${th.border}`,position:"relative"}}>
                {markers.map((m,i)=>(
                  <div key={i} style={{position:"absolute",left:m.offset*pxPerDay+4,top:"50%",transform:"translateY(-50%)",
                    fontSize:10,color:th.text2,fontWeight:600,whiteSpace:"nowrap"}}>{m.label}</div>
                ))}
                {/* Today line header */}
                {todayOffset>=0&&todayOffset<=totalDays&&(
                  <div style={{position:"absolute",left:todayOffset*pxPerDay,top:0,bottom:0,
                    width:2,background:"#ef4444",opacity:.7}}/>
                )}
              </div>
              {/* Rows */}
              {sorted.map(item=>(
                <div key={item.id} style={{height:46,borderBottom:`1px solid ${th.border}`,position:"relative"}}>
                  {markers.map((m,i)=>(
                    <div key={i} style={{position:"absolute",left:m.offset*pxPerDay,top:0,bottom:0,
                      width:1,background:th.border,opacity:.4}}/>
                  ))}
                  {/* Today line */}
                  {todayOffset>=0&&todayOffset<=totalDays&&(
                    <div style={{position:"absolute",left:todayOffset*pxPerDay,top:0,bottom:0,
                      width:2,background:"#ef4444",opacity:.5,zIndex:2}}/>
                  )}
                  {/* Bar */}
                  <div style={{position:"absolute",left:dayOff(item.startDate)*pxPerDay,
                    width:barW(item.startDate,item.endDate),
                    top:"50%",transform:"translateY(-50%)",height:26,borderRadius:6,
                    background:PRIORITY_COLORS[item.priority]||"#6366f1",opacity:.85,
                    display:"flex",alignItems:"center",padding:"0 8px",overflow:"hidden",cursor:"pointer",zIndex:1}}
                    onClick={()=>onEdit(item)}>
                    <span style={{fontSize:11,color:"#fff",fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{item.name}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        {/* Legend */}
        <div style={{padding:"8px 12px",borderTop:`1px solid ${th.border}`,display:"flex",gap:16,
          background:th.surface2,fontSize:11,color:th.text2,alignItems:"center"}}>
          <span style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:12,height:3,background:"#ef4444",display:"inline-block"}}/>Hoy</span>
          {Object.entries(PRIORITY_COLORS).map(([k,v])=>(
            <span key={k} style={{display:"flex",alignItems:"center",gap:4}}>
              <span style={{width:12,height:10,background:v,borderRadius:3,display:"inline-block"}}/>
              {k}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── LIST ──────────────────────────────────────────────────────────────────────
function ListView({projects,th,s,sc,onEdit,onNew,onDelete,calcProgress}) {
  const [expanded, setExpanded] = useState({});
  const toggle = id=>setExpanded(e=>({...e,[id]:!e[id]}));
  return (
    <div>
      <h2 style={{margin:"0 0 14px",fontSize:16,fontWeight:700,color:th.text}}>Vista de lista</h2>
      {projects.map(p=>{
        const allTasks=(p.subprojects||[]).flatMap(sp=>sp.tasks||[]);
        const prog=calcProgress(allTasks);
        return(
          <div key={p.id} style={{background:th.surface,border:`1px solid ${th.border}`,borderRadius:12,marginBottom:12,overflow:"hidden"}}>
            <div style={{display:"flex",alignItems:"center",gap:10,padding:"12px 14px",
              borderLeft:`4px solid ${p.color}`,cursor:"pointer",background:expanded[p.id]?th.surface2:th.surface}}
              onClick={()=>toggle(p.id)}>
              <span style={{color:th.text2,fontSize:13}}>{expanded[p.id]?"▾":"▸"}</span>
              <span style={{fontWeight:700,fontSize:14,color:th.text,flex:1}}>{p.name}</span>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <span style={{fontSize:11,color:th.text2,background:th.surface2,padding:"2px 8px",borderRadius:20}}>{prog}%</span>
                <span style={s.tag(p.status)}>{p.status}</span>
                <span style={s.prio(p.priority)}>{p.priority}</span>
                <button style={{...s.iconBtn,fontSize:11,padding:"3px 8px"}} onClick={e=>{e.stopPropagation();onEdit({...p,_type:"project"});}}>✏</button>
                <button style={{...s.iconBtn,fontSize:11,padding:"3px 8px"}} onClick={e=>{e.stopPropagation();onNew("subproject",p.id);}}>+ Sub</button>
              </div>
            </div>
            {expanded[p.id]&&(
              <div style={{borderTop:`1px solid ${th.border}`}}>
                {(p.subprojects||[]).map(sp=>(
                  <div key={sp.id} style={{borderBottom:`1px solid ${th.border}`}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,padding:"9px 14px 9px 28px",
                      cursor:"pointer",background:expanded[sp.id]?th.surface2+"88":"transparent"}}
                      onClick={()=>toggle(sp.id)}>
                      <span style={{color:th.text2,fontSize:12}}>{expanded[sp.id]?"▾":"▸"}</span>
                      <span style={{fontSize:13,color:th.text,flex:1,fontWeight:600}}>↳ {sp.name}</span>
                      <span style={{fontSize:11,color:th.text2}}>{calcProgress(sp.tasks||[])}%</span>
                      <span style={s.tag(sp.status)}>{sp.status}</span>
                      <span style={s.prio(sp.priority)}>{sp.priority}</span>
                      <button style={{...s.iconBtn,fontSize:11,padding:"3px 7px"}} onClick={e=>{e.stopPropagation();onEdit({...sp,_type:"subproject",_projectId:p.id});}}>✏</button>
                      <button style={{...s.iconBtn,fontSize:11,padding:"3px 7px"}} onClick={e=>{e.stopPropagation();onNew("task",p.id,sp.id);}}>+ Tarea</button>
                    </div>
                    {expanded[sp.id]&&(sp.tasks||[]).map(t=>(
                      <div key={t.id} style={{display:"flex",alignItems:"center",gap:8,
                        padding:"7px 14px 7px 50px",borderTop:`1px solid ${th.border}`,background:th.surface}}>
                        <span style={{color:th.text2,fontSize:12}}>◦</span>
                        <span style={{fontSize:13,color:th.text,flex:1}}>{t.name}</span>
                        {t.subtasks?.length>0&&<span style={{fontSize:11,color:th.text2}}>{t.subtasks.filter(st=>st.status==="Completado").length}/{t.subtasks.length} sub</span>}
                        {t.dependsOn?.length>0&&<span style={{fontSize:10,color:"#f59e0b"}}>⛓ dep</span>}
                        <span style={s.tag(t.status)}>{t.status}</span>
                        <span style={s.prio(t.priority)}>{t.priority}</span>
                        <span style={{fontSize:11,color:th.text2,maxWidth:100,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.assignees?.join(", ")}</span>
                        <button style={{...s.iconBtn,fontSize:11,padding:"3px 7px"}} onClick={()=>onEdit({...t,_type:"task",_projectId:p.id,_spId:sp.id})}>✏</button>
                      </div>
                    ))}
                  </div>
                ))}
                {!(p.subprojects?.length)&&(
                  <div style={{padding:"12px 28px",color:th.text2,fontSize:12}}>Sin subproyectos</div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── MODAL ─────────────────────────────────────────────────────────────────────
function ItemModal({data,th,s,projects,onSave,onClose,onDelete}) {
  const [form, setForm] = useState(data);
  const [assigneeInput, setAssigneeInput] = useState("");
  const [subtaskInput, setSubtaskInput] = useState("");
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const allTasks = projects.flatMap(p=>(p.subprojects||[]).flatMap(sp=>(sp.tasks||[]).map(t=>({...t,_pName:p.name,_spName:sp.name}))));
  const typeLabel={project:"Proyecto",subproject:"Subproyecto",task:"Tarea"}[form._type]||"Ítem";

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.55)",display:"flex",
      alignItems:"center",justifyContent:"center",zIndex:1000}}
      onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div style={{background:th.surface,borderRadius:16,padding:22,width:500,maxHeight:"90vh",
        overflowY:"auto",border:`1px solid ${th.border}`}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18}}>
          <h3 style={{margin:0,fontSize:15,fontWeight:700,color:th.text}}>
            {form._isNew?"Nuevo":"Editar"} {typeLabel}
          </h3>
          <button style={s.iconBtn} onClick={onClose}>✕</button>
        </div>

        <Fld label="Nombre" th={th}><input style={s.input} value={form.name||""} onChange={e=>set("name",e.target.value)} placeholder="Nombre..."/></Fld>
        {form._type==="project"&&<Fld label="Descripción" th={th}><textarea style={{...s.input,height:64,resize:"vertical"}} value={form.description||""} onChange={e=>set("description",e.target.value)}/></Fld>}

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <Fld label="Estado" th={th}>
            <select style={s.input} value={form.status||"Pendiente"} onChange={e=>set("status",e.target.value)}>
              {STATUSES.map(st=><option key={st}>{st}</option>)}
            </select>
          </Fld>
          <Fld label="Prioridad" th={th}>
            <select style={s.input} value={form.priority||"Media"} onChange={e=>set("priority",e.target.value)}>
              {PRIORITIES.map(p=><option key={p}>{p}</option>)}
            </select>
          </Fld>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <Fld label="Fecha inicio" th={th}><input type="date" style={s.input} value={form.startDate||""} onChange={e=>set("startDate",e.target.value)}/></Fld>
          <Fld label="Fecha fin" th={th}><input type="date" style={s.input} value={form.endDate||""} onChange={e=>set("endDate",e.target.value)}/></Fld>
        </div>

        {form._type==="project"&&(
          <Fld label="Color" th={th}>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {["#6366f1","#10b981","#f59e0b","#ef4444","#ec4899","#3b82f6","#8b5cf6","#14b8a6"].map(c=>(
                <div key={c} onClick={()=>set("color",c)} style={{width:26,height:26,borderRadius:"50%",
                  background:c,cursor:"pointer",border:`3px solid ${form.color===c?"#fff":"transparent"}`,
                  outline:form.color===c?`2px solid ${c}`:"none"}}/>
              ))}
            </div>
          </Fld>
        )}

        {form._isNew&&form._type!=="project"&&(
          <Fld label="Proyecto" th={th}>
            <select style={s.input} value={form._projectId||""} onChange={e=>set("_projectId",e.target.value)}>
              {projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Fld>
        )}
        {form._isNew&&form._type==="task"&&(
          <Fld label="Subproyecto" th={th}>
            <select style={s.input} value={form._spId||""} onChange={e=>set("_spId",e.target.value)}>
              {(projects.find(p=>p.id===form._projectId)?.subprojects||[]).map(sp=><option key={sp.id} value={sp.id}>{sp.name}</option>)}
            </select>
          </Fld>
        )}

        {/* Assignees */}
        <Fld label="Personas asignadas" th={th}>
          <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:6}}>
            {(form.assignees||[]).map((a,i)=>(
              <span key={i} style={{fontSize:12,background:th.surface2,color:th.text2,
                padding:"3px 8px",borderRadius:20,border:`1px solid ${th.border}`,display:"flex",alignItems:"center",gap:4}}>
                {a}<span style={{cursor:"pointer",color:"#ef4444"}} onClick={()=>set("assignees",(form.assignees||[]).filter((_,j)=>j!==i))}>×</span>
              </span>
            ))}
          </div>
          <div style={{display:"flex",gap:6}}>
            <input style={{...s.input,flex:1}} value={assigneeInput} onChange={e=>setAssigneeInput(e.target.value)}
              placeholder="Nombre..." onKeyDown={e=>{if(e.key==="Enter"&&assigneeInput.trim()){set("assignees",[...(form.assignees||[]),assigneeInput.trim()]);setAssigneeInput("");}}}/>
            <button style={s.iconBtn} onClick={()=>{if(assigneeInput.trim()){set("assignees",[...(form.assignees||[]),assigneeInput.trim()]);setAssigneeInput("");}}}>+</button>
          </div>
        </Fld>

        {/* Dependencies (tasks only) */}
        {form._type==="task"&&allTasks.length>0&&(
          <Fld label="Depende de (tareas)" th={th}>
            <div style={{maxHeight:100,overflowY:"auto",border:`1px solid ${th.border}`,borderRadius:8,padding:6}}>
              {allTasks.filter(t=>t.id!==form.id).map(t=>(
                <label key={t.id} style={{display:"flex",alignItems:"center",gap:6,padding:"3px 0",cursor:"pointer",fontSize:12,color:th.text}}>
                  <input type="checkbox" checked={(form.dependsOn||[]).includes(t.id)}
                    onChange={e=>{
                      const deps=form.dependsOn||[];
                      set("dependsOn",e.target.checked?[...deps,t.id]:deps.filter(d=>d!==t.id));
                    }}/>
                  {t.name} <span style={{color:th.text2,fontSize:10}}>({t._pName})</span>
                </label>
              ))}
            </div>
          </Fld>
        )}

        {/* Subtasks */}
        {form._type==="task"&&(
          <Fld label="Subtareas" th={th}>
            {(form.subtasks||[]).map((st,i)=>(
              <div key={st.id} style={{display:"flex",alignItems:"center",gap:6,marginBottom:5}}>
                <input type="checkbox" checked={st.status==="Completado"}
                  onChange={e=>{const subs=[...(form.subtasks||[])];subs[i]={...subs[i],status:e.target.checked?"Completado":"Pendiente"};set("subtasks",subs);}}/>
                <span style={{flex:1,fontSize:12,color:st.status==="Completado"?th.text2:th.text,
                  textDecoration:st.status==="Completado"?"line-through":"none"}}>{st.name}</span>
                <span style={{cursor:"pointer",color:"#ef4444",fontSize:13}} onClick={()=>set("subtasks",(form.subtasks||[]).filter((_,j)=>j!==i))}>×</span>
              </div>
            ))}
            <div style={{display:"flex",gap:6,marginTop:4}}>
              <input style={{...s.input,flex:1,padding:"5px 8px"}} value={subtaskInput}
                onChange={e=>setSubtaskInput(e.target.value)} placeholder="Nueva subtarea..."
                onKeyDown={e=>{if(e.key==="Enter"&&subtaskInput.trim()){set("subtasks",[...(form.subtasks||[]),{id:genId(),name:subtaskInput.trim(),status:"Pendiente"}]);setSubtaskInput("");}}}/>
              <button style={s.iconBtn} onClick={()=>{if(subtaskInput.trim()){set("subtasks",[...(form.subtasks||[]),{id:genId(),name:subtaskInput.trim(),status:"Pendiente"}]);setSubtaskInput("");}}} >+</button>
            </div>
          </Fld>
        )}

        <div style={{display:"flex",justifyContent:"space-between",marginTop:18,gap:8}}>
          {!form._isNew&&(
            <button style={{...s.iconBtn,color:"#ef4444",borderColor:"#ef4444"}}
              onClick={()=>{if(window.confirm("¿Eliminar este ítem?"))onDelete(form.id,form._type);}}>Eliminar</button>
          )}
          <div style={{display:"flex",gap:8,marginLeft:"auto"}}>
            <button style={s.iconBtn} onClick={onClose}>Cancelar</button>
            <button style={{...s.btn(true),background:"#6366f1",color:"#fff",border:"none"}} onClick={()=>onSave(form)}>
              {form._isNew?"Crear":"Guardar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Fld({label,th,children}) {
  return(
    <div style={{marginBottom:13}}>
      <label style={{display:"block",fontSize:11,fontWeight:700,color:th.text2,marginBottom:4,textTransform:"uppercase",letterSpacing:.5}}>{label}</label>
      {children}
    </div>
  );
}