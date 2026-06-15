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
    <div className="font-['Inter',sans-serif] h-full flex flex-col relative">
      {/* Header Section */}
      <div className="flex justify-between items-end mb-8">
        <div>
          <div className="font-mono text-[12px] text-[#E5322B] tracking-[0.16em] uppercase font-medium flex items-center gap-2 mb-2">
            <span className="w-1.5 h-1.5 rounded-none bg-[#E5322B]"></span>
            Active Builds
          </div>
          <h1 className="text-[32px] font-bold text-[#17222F] leading-none tracking-tight">Project Pipeline</h1>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="bg-[#17222F] text-white px-5 py-2.5 rounded-none font-semibold text-[14.5px] flex items-center gap-2 hover:-translate-y-0.5 transition-transform"
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
                <h3 className="font-semibold text-[#17222F] text-[16px]">{stage}</h3>
                <span className="bg-[#17222F] text-[#5A6473] font-mono text-[11px] px-2 py-0.5 rounded-none font-semibold">
                  {columnProjects.length}
                </span>
              </div>

              {/* Column Content */}
              <div className="bg-[#F2F2F2] border border-[#17222F] rounded-none p-3 flex-1 flex flex-col gap-3 min-h-[500px] transition-colors duration-200">
                {columnProjects.map((project) => (
                  <div 
                    key={project.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, project.id)}
                    className="bg-[#FFFFFF] border border-[#17222F] rounded-none p-5 hover:border-[#E5322B] transition-colors cursor-grab active:cursor-grabbing group hover:"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <span className="bg-[#F2F2F2] text-[#E5322B] font-mono text-[10px] px-2 py-1 rounded-none uppercase tracking-wider font-semibold truncate max-w-[180px]">
                        {project.client}
                      </span>
                      <button className="text-[#9AA0AD] hover:text-[#17222F] transition-colors">
                        <MoreHorizontal size={16} />
                      </button>
                    </div>
                    
                    <h4 className="font-bold text-[#17222F] text-[17px] leading-tight mb-4">
                      {project.title}
                    </h4>
                    
                    <div className="flex items-center gap-2 text-[#5A6473] font-mono text-[12px] border-t border-[#17222F] pt-3">
                      <Calendar size={13} />
                      <span>Due {project.dueDate}</span>
                    </div>
                  </div>
                ))}
                
                {/* Empty State for Drop Zone */}
                {columnProjects.length === 0 && (
                  <div className="flex-1 border-2 border-dashed border-[#17222F] rounded-none flex items-center justify-center text-[#9AA0AD] font-mono text-[12px] pointer-events-none">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#17222F] bg-opacity-40 backdrop-blur-sm">
          <div className="bg-[#FFFFFF] w-full max-w-md border border-[#17222F] rounded-none overflow-hidden flex flex-col">
            
            <div className="px-8 py-6 border-b border-[#17222F] flex justify-between items-center bg-[#FFFFFF]">
              <div>
                <div className="font-mono text-[11px] text-[#E5322B] tracking-[0.16em] uppercase font-semibold mb-1">Pipeline</div>
                <h2 className="text-[22px] font-bold text-[#17222F] leading-none">Add New Project</h2>
              </div>
              <button 
                onClick={() => setShowAddModal(false)} 
                className="w-8 h-8 flex items-center justify-center rounded-none bg-[#17222F] text-[#5A6473] hover:bg-[#17222F] transition-colors"
              >
                <X size={16} strokeWidth={2.5} />
              </button>
            </div>

            <form onSubmit={handleAddProject} className="p-8 flex flex-col gap-5">
              <div>
                <label className="block font-mono text-[12px] text-[#5A6473] mb-[7px]">Project Title</label>
                <input
                  type="text"
                  value={newProject.title}
                  onChange={(e) => setNewProject({...newProject, title: e.target.value})}
                  placeholder="e.g. NGO Management App"
                  className="w-full px-[14px] py-[13px] rounded-none border border-[#17222F] bg-[#FFFFFF] text-[#17222F] text-[15px] focus:outline-none focus:border-[#E5322B] focus: transition-all"
                  required
                />
              </div>
              
              <div>
                <label className="block font-mono text-[12px] text-[#5A6473] mb-[7px]">Client Name</label>
                <input
                  type="text"
                  value={newProject.client}
                  onChange={(e) => setNewProject({...newProject, client: e.target.value})}
                  placeholder="e.g. Hope Foundation"
                  className="w-full px-[14px] py-[13px] rounded-none border border-[#17222F] bg-[#FFFFFF] text-[#17222F] text-[15px] focus:outline-none focus:border-[#E5322B] focus: transition-all"
                  required
                />
              </div>

              <div>
                <label className="block font-mono text-[12px] text-[#5A6473] mb-[7px]">Due Date</label>
                <input
                  type="text"
                  value={newProject.dueDate}
                  onChange={(e) => setNewProject({...newProject, dueDate: e.target.value})}
                  placeholder="e.g. Q4 2026, or Nov 1st"
                  className="w-full px-[14px] py-[13px] rounded-none border border-[#17222F] bg-[#FFFFFF] text-[#17222F] text-[15px] focus:outline-none focus:border-[#E5322B] focus: transition-all"
                />
              </div>

              <div className="mt-4 flex gap-3">
                <button 
                  type="button" 
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 bg-[#F2F2F2] text-[#5A6473] font-semibold text-[15px] py-[15px] rounded-none hover:bg-[#17222F] transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-[#17222F] text-white font-semibold text-[15px] py-[15px] rounded-none hover:-translate-y-[2px] transition-transform disabled:opacity-70 disabled:cursor-not-allowed"
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