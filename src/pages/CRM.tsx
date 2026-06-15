import { useEffect, useState } from "react";
import { collection, onSnapshot, query, orderBy, doc, updateDoc, deleteDoc, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Plus, Building2, Mail, Phone, Edit2, X, Trash2, Users } from "lucide-react";
import { PageHeader, Loader } from "../components/ui";
import { logAction } from "../lib/audit";
import { useAuth } from "../lib/auth-context";

interface Client {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  status: "Active" | "Past Client";
  value?: string;
  createdAt?: any;
}

export default function CRM() {
  const { can } = useAuth();
  const canWrite = can("crm", "write");
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    company: "",
    email: "",
    phone: "",
    status: "Active" as "Active" | "Past Client",
    value: ""
  });

  useEffect(() => {
    const q = query(collection(db, "clients"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const clientData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Client[];
      setClients(clientData);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const openAddModal = () => {
    setModalMode("add");
    setEditingId(null);
    setFormData({ name: "", company: "", email: "", phone: "", status: "Active", value: "" });
    setShowModal(true);
  };

  const openEditModal = (client: Client) => {
    setModalMode("edit");
    setEditingId(client.id);
    setFormData({
      name: client.name,
      company: client.company === "N/A" ? "" : client.company,
      email: client.email,
      phone: client.phone === "N/A" ? "" : client.phone,
      status: client.status || "Active",
      value: client.value || ""
    });
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const dataToSave = {
        name: formData.name,
        company: formData.company || "N/A",
        email: formData.email,
        phone: formData.phone || "N/A",
        status: formData.status,
        value: formData.value,
      };

      if (modalMode === "add") {
        await addDoc(collection(db, "clients"), { ...dataToSave, createdAt: serverTimestamp() });
        await logAction("Added client", dataToSave.name);
      } else if (modalMode === "edit" && editingId) {
        await updateDoc(doc(db, "clients", editingId), dataToSave);
        await logAction("Updated client", dataToSave.name);
      }
      setShowModal(false);
    } catch (error) {
      console.error("Error saving client:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!editingId) return;
    if (confirm("Are you sure you want to completely delete this client? This cannot be undone.")) {
      try {
        await deleteDoc(doc(db, "clients", editingId));
        await logAction("Deleted client", formData.name);
        setShowModal(false);
      } catch (error) {
        console.error("Error deleting client:", error);
      }
    }
  };

  if (loading) return <Loader label="Loading CRM" sub="Loading your client directory" />;

  const activeCount = clients.filter((c) => c.status === "Active").length;

  return (
    <div className="font-['Inter',sans-serif] relative">
      <PageHeader
        icon={Users}
        eyebrow="Lead Management"
        accent="#0F9D6B"
        title="CRM"
        subtitle="Your won clients. Leads that reach the final pipeline stage land here automatically — add your own any time."
        stats={[
          { label: "Active", value: activeCount, accent: "#0F9D6B" },
          { label: "Total", value: clients.length, accent: "#17222F" },
        ]}
        actions={canWrite && (
          <button
            onClick={openAddModal}
            className="bg-[#17222F] text-white px-5 py-2.5 rounded-none font-semibold text-[14.5px] flex items-center gap-2 hover:-translate-y-0.5 transition-transform justify-center"
          >
            <Plus size={18} /> Add Client
          </button>
        )}
      />

      {/* CRM Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-up">
        {clients.map((client) => (
          <div 
            key={client.id} 
            className="bg-[#FFFFFF] border border-[#17222F] rounded-none p-6 hover:border-[#0F9D6B] transition-colors group hover: flex flex-col relative"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="w-12 h-12 rounded-none bg-[#E6F6EF] text-[#0F9D6B] flex items-center justify-center font-bold text-xl border border-[#0F9D6B] border-opacity-20">
                {client.company !== "N/A" ? client.company.charAt(0) : client.name.charAt(0)}
              </div>
              {canWrite && (
                <button
                  onClick={() => openEditModal(client)}
                  className="text-[#9AA0AD] hover:text-[#17222F] transition-colors p-2 bg-[#F2F2F2] rounded-none opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
                >
                  <Edit2 size={16} />
                </button>
              )}
            </div>
            
            <div className="mb-4">
              <h3 className="font-bold text-[#17222F] text-[19px] leading-tight mb-1">
                {client.company !== "N/A" ? client.company : client.name}
              </h3>
              <div className="flex items-center gap-2 text-[#5A6473] text-[14.5px]">
                {client.company !== "N/A" && <span>{client.name}</span>}
              </div>
            </div>

            <div className="space-y-2 mt-auto pt-4 border-t border-[#17222F]">
              <div className="flex items-center gap-3 text-[#5A6473] text-[13.5px]">
                <Mail size={14} className="text-[#9AA0AD]" />
                <span className="truncate">{client.email}</span>
              </div>
              <div className="flex items-center gap-3 text-[#5A6473] text-[13.5px]">
                <Phone size={14} className="text-[#9AA0AD]" />
                <span>{client.phone}</span>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between">
              <span className={`font-mono text-[11px] px-2.5 py-1 rounded-none-none uppercase tracking-wider font-semibold ${
                client.status === "Active" ? "bg-[#E6F6EF] text-[#0F9D6B]" : "bg-[#F2F2F2] text-[#5A6473]"
              }`}>
                {client.status}
              </span>
              {client.value && (
                <span className="font-semibold text-[#17222F] text-[14.5px]">
                  {client.value}
                </span>
              )}
            </div>
          </div>
        ))}

        {clients.length === 0 && (
          <div className="col-span-full border-2 border-dashed border-[#17222F] rounded-none p-12 flex flex-col items-center justify-center text-center bg-white bg-opacity-50">
            <div className="w-16 h-16 rounded-none bg-[#F2F2F2] flex items-center justify-center text-[#9AA0AD] mb-4">
              <Building2 size={24} />
            </div>
            <h3 className="text-[#17222F] font-bold text-[18px] mb-2">No clients yet</h3>
            <p className="text-[#5A6473] text-[15px] max-w-sm">
              When you convert a lead from the Triage dashboard, they will automatically appear here.
            </p>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#17222F] bg-opacity-40 backdrop-blur-sm overflow-y-auto">
          <div className="bg-[#FFFFFF] w-full max-w-lg border border-[#17222F] rounded-none overflow-hidden flex flex-col my-8">
            
            <div className="px-6 py-5 md:px-8 md:py-6 border-b border-[#17222F] flex justify-between items-center bg-[#FFFFFF]">
              <h2 className="text-[20px] md:text-[22px] font-bold text-[#17222F] leading-none">
                {modalMode === "add" ? "Add New Client" : "Edit Client"}
              </h2>
              <button onClick={() => setShowModal(false)} className="w-8 h-8 flex items-center justify-center rounded-none bg-[#17222F] text-[#5A6473] hover:bg-[#17222F]">
                <X size={16} strokeWidth={2.5} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 md:p-8 flex flex-col gap-5 max-h-[75vh] overflow-y-auto">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block font-mono text-[12px] text-[#5A6473] mb-[7px]">Contact Name</label>
                  <input type="text" required value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="w-full px-[14px] py-[13px] rounded-none border border-[#17222F] bg-[#FFFFFF] text-[#17222F] focus:border-[#0F9D6B] outline-none" />
                </div>
                <div>
                  <label className="block font-mono text-[12px] text-[#5A6473] mb-[7px]">Company (Optional)</label>
                  <input type="text" value={formData.company} onChange={(e) => setFormData({...formData, company: e.target.value})} className="w-full px-[14px] py-[13px] rounded-none border border-[#17222F] bg-[#FFFFFF] text-[#17222F] focus:border-[#0F9D6B] outline-none" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block font-mono text-[12px] text-[#5A6473] mb-[7px]">Email Address</label>
                  <input type="email" required value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} className="w-full px-[14px] py-[13px] rounded-none border border-[#17222F] bg-[#FFFFFF] text-[#17222F] focus:border-[#0F9D6B] outline-none" />
                </div>
                <div>
                  <label className="block font-mono text-[12px] text-[#5A6473] mb-[7px]">Phone Number</label>
                  <input type="text" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} className="w-full px-[14px] py-[13px] rounded-none border border-[#17222F] bg-[#FFFFFF] text-[#17222F] focus:border-[#0F9D6B] outline-none" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 border-t border-[#17222F] pt-5 mt-2">
                <div>
                  <label className="block font-mono text-[12px] text-[#5A6473] mb-[7px]">Client Status</label>
                  <select value={formData.status} onChange={(e) => setFormData({...formData, status: e.target.value as any})} className="w-full px-[14px] py-[13px] rounded-none border border-[#17222F] bg-[#FFFFFF] text-[#17222F] focus:border-[#0F9D6B] outline-none appearance-none">
                    <option value="Active">Active</option>
                    <option value="Past Client">Past Client</option>
                  </select>
                </div>
                <div>
                  <label className="block font-mono text-[12px] text-[#5A6473] mb-[7px]">Contract Value (Optional)</label>
                  <input type="text" placeholder="e.g. $15,000" value={formData.value} onChange={(e) => setFormData({...formData, value: e.target.value})} className="w-full px-[14px] py-[13px] rounded-none border border-[#17222F] bg-[#FFFFFF] text-[#17222F] focus:border-[#0F9D6B] outline-none" />
                </div>
              </div>

              <div className="flex flex-col-reverse md:flex-row justify-between items-center gap-4 mt-6">
                {modalMode === "edit" ? (
                  <button type="button" onClick={handleDelete} className="text-[#E5322B] font-semibold text-[14.5px] hover:bg-[#FBE9E7] px-4 py-3 rounded-none transition-colors flex items-center gap-2 w-full md:w-auto justify-center">
                    <Trash2 size={16} /> Delete
                  </button>
                ) : (
                  <div /> /* Empty div for flex spacing */
                )}
                
                <div className="flex gap-3 w-full md:w-auto">
                  <button type="button" onClick={() => setShowModal(false)} className="flex-1 md:flex-none bg-[#F2F2F2] text-[#5A6473] font-semibold px-6 py-3 rounded-none hover:bg-[#17222F] transition-colors">
                    Cancel
                  </button>
                  <button type="submit" disabled={isSubmitting} className="flex-1 md:flex-none bg-[#0F9D6B] text-white font-semibold px-8 py-3 rounded-none hover:-translate-y-[2px] transition-transform disabled:opacity-70">
                    {isSubmitting ? "Saving..." : "Save Client"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}