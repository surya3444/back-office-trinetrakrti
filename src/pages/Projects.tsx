import { useState, useEffect } from "react";
import { collection, onSnapshot, query, orderBy, doc, updateDoc, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Plus, MoreHorizontal, Calendar, X } from "lucide-react";

interface Project {
  id: string;
  title: string;
  client: string;
  stage: string;
  dueDate: string;
  createdAt?: any;
}

const STAGES = ["Understand", "Design", "Build", "Automate", "Scale"];

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal State for adding new projects
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newProject, setNewProject] = useState({
    title: "",
    client: "",
    dueDate: "",
  });

  // 1. Listen to the 'projects' collection in real-time
  useEffect(() => {
    const q = query(collection(db, "projects"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const projectData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Project[];
      
      setProjects(projectData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // 2. Handle HTML5 Drag and Drop
  const handleDragStart = (e: React.DragEvent, projectId: string) => {
    e.dataTransfer.setData("projectId", projectId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // Necessary to allow dropping
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = async (e: React.DragEvent, targetStage: string) => {
    e.preventDefault();
    const projectId = e.dataTransfer.getData("projectId");
    if (!projectId) return;

    // Check if the stage actually changed
    const project = projects.find(p => p.id === projectId);
    if (project && project.stage !== targetStage) {
      try {
        const projectRef = doc(db, "projects", projectId);
        await updateDoc(projectRef, { stage: targetStage });
      } catch (error) {
        console.error("Error updating project stage:", error);
      }
    }
  };

  // 3. Handle adding a new project
  const handleAddProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProject.title || !newProject.client) return;
    
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "projects"), {
        title: newProject.title,
        client: newProject.client,
        dueDate: newProject.dueDate || "TBD",
        stage: "Understand", // Always defaults to the first stage
        createdAt: serverTimestamp()
      });
      setShowAddModal(false);
      setNewProject({ title: "", client: "", dueDate: "" });
    } catch (error) {
      console.error("Error adding project:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <div className="text-[#9AA0AD] animate-pulse font-medium">Loading project board...</div>;

  return (
    <div className="font-['Poppins',sans-serif] h-full flex flex-col relative">
      {/* Header Section */}
      <div className="flex justify-between items-end mb-8">
        <div>
          <div className="font-mono text-[12px] text-[#FF5C49] tracking-[0.16em] uppercase font-medium flex items-center gap-2 mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#FF5C49]"></span>
            Active Builds
          </div>
          <h1 className="text-[32px] font-bold text-[#13182B] leading-none tracking-tight">Project Pipeline</h1>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="bg-[#13182B] text-white px-5 py-2.5 rounded-xl font-semibold text-[14.5px] flex items-center gap-2 hover:-translate-y-0.5 transition-transform shadow-[0_10px_20px_-10px_rgba(19,24,43,0.5)]"
        >
          <Plus size={18} />
          New Project
        </button>
      </div>

      {/* Kanban Board */}
      <div className="flex gap-6 overflow-x-auto pb-4 flex-1">
        {STAGES.map((stage) => {
          const columnProjects = projects.filter((p) => p.stage === stage);
          
          return (
            <div 
              key={stage} 
              className="min-w-[320px] w-[320px] flex flex-col"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, stage)}
            >
              {/* Column Header */}
              <div className="flex justify-between items-center mb-4 px-1">
                <h3 className="font-semibold text-[#13182B] text-[16px]">{stage}</h3>
                <span className="bg-[#E5E2D9] text-[#6B7283] font-mono text-[11px] px-2 py-0.5 rounded-full font-semibold">
                  {columnProjects.length}
                </span>
              </div>

              {/* Column Content */}
              <div className="bg-[#F4F2EC] border border-[#E5E2D9] rounded-[20px] p-3 flex-1 flex flex-col gap-3 min-h-[500px] transition-colors duration-200">
                {columnProjects.map((project) => (
                  <div 
                    key={project.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, project.id)}
                    className="bg-[#FFFFFF] border border-[#D7D3C7] rounded-2xl p-5 hover:border-[#FF5C49] transition-colors cursor-grab active:cursor-grabbing group shadow-sm hover:shadow-md"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <span className="bg-[#EDEFFF] text-[#2B41E0] font-mono text-[10px] px-2 py-1 rounded-md uppercase tracking-wider font-semibold truncate max-w-[180px]">
                        {project.client}
                      </span>
                      <button className="text-[#9AA0AD] hover:text-[#13182B] transition-colors">
                        <MoreHorizontal size={16} />
                      </button>
                    </div>
                    
                    <h4 className="font-bold text-[#13182B] text-[17px] leading-tight mb-4">
                      {project.title}
                    </h4>
                    
                    <div className="flex items-center gap-2 text-[#6B7283] font-mono text-[12px] border-t border-[#E5E2D9] pt-3">
                      <Calendar size={13} />
                      <span>Due {project.dueDate}</span>
                    </div>
                  </div>
                ))}
                
                {/* Empty State for Drop Zone */}
                {columnProjects.length === 0 && (
                  <div className="flex-1 border-2 border-dashed border-[#D7D3C7] rounded-2xl flex items-center justify-center text-[#9AA0AD] font-mono text-[12px] pointer-events-none">
                    Drop here
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Project Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#13182B] bg-opacity-40 backdrop-blur-sm">
          <div className="bg-[#FFFFFF] w-full max-w-md border border-[#D7D3C7] rounded-[24px] shadow-[0_30px_60px_-20px_rgba(19,24,43,0.3)] overflow-hidden flex flex-col">
            
            <div className="px-8 py-6 border-b border-[#E5E2D9] flex justify-between items-center bg-[#FCFBF8]">
              <div>
                <div className="font-mono text-[11px] text-[#FF5C49] tracking-[0.16em] uppercase font-semibold mb-1">Pipeline</div>
                <h2 className="text-[22px] font-bold text-[#13182B] leading-none">Add New Project</h2>
              </div>
              <button 
                onClick={() => setShowAddModal(false)} 
                className="w-8 h-8 flex items-center justify-center rounded-full bg-[#E5E2D9] text-[#6B7283] hover:bg-[#D7D3C7] transition-colors"
              >
                <X size={16} strokeWidth={2.5} />
              </button>
            </div>

            <form onSubmit={handleAddProject} className="p-8 flex flex-col gap-5">
              <div>
                <label className="block font-mono text-[12px] text-[#6B7283] mb-[7px]">Project Title</label>
                <input
                  type="text"
                  value={newProject.title}
                  onChange={(e) => setNewProject({...newProject, title: e.target.value})}
                  placeholder="e.g. NGO Management App"
                  className="w-full px-[14px] py-[13px] rounded-xl border border-[#D7D3C7] bg-[#FCFBF8] text-[#13182B] text-[15px] focus:outline-none focus:border-[#FF5C49] focus:shadow-[0_0_0_4px_#FFEDE9] transition-all"
                  required
                />
              </div>
              
              <div>
                <label className="block font-mono text-[12px] text-[#6B7283] mb-[7px]">Client Name</label>
                <input
                  type="text"
                  value={newProject.client}
                  onChange={(e) => setNewProject({...newProject, client: e.target.value})}
                  placeholder="e.g. Hope Foundation"
                  className="w-full px-[14px] py-[13px] rounded-xl border border-[#D7D3C7] bg-[#FCFBF8] text-[#13182B] text-[15px] focus:outline-none focus:border-[#FF5C49] focus:shadow-[0_0_0_4px_#FFEDE9] transition-all"
                  required
                />
              </div>

              <div>
                <label className="block font-mono text-[12px] text-[#6B7283] mb-[7px]">Due Date</label>
                <input
                  type="text"
                  value={newProject.dueDate}
                  onChange={(e) => setNewProject({...newProject, dueDate: e.target.value})}
                  placeholder="e.g. Q4 2026, or Nov 1st"
                  className="w-full px-[14px] py-[13px] rounded-xl border border-[#D7D3C7] bg-[#FCFBF8] text-[#13182B] text-[15px] focus:outline-none focus:border-[#FF5C49] focus:shadow-[0_0_0_4px_#FFEDE9] transition-all"
                />
              </div>

              <div className="mt-4 flex gap-3">
                <button 
                  type="button" 
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 bg-[#F4F2EC] text-[#6B7283] font-semibold text-[15px] py-[15px] rounded-xl hover:bg-[#E5E2D9] transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-[#13182B] text-white font-semibold text-[15px] py-[15px] rounded-xl shadow-[0_14px_30px_-14px_rgba(19,24,43,0.55)] hover:-translate-y-[2px] transition-transform disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? "Adding..." : "Add Project"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}