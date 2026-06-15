import { useEffect, useState } from "react";
import { collection, onSnapshot, query, orderBy, addDoc, deleteDoc, doc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Plus, X, Trash2, ExternalLink, Image as ImageIcon } from "lucide-react";
import { Loader } from "../components/ui";
import { logAction } from "../lib/audit";
import { useAuth } from "../lib/auth-context";

type ProductStatus = "Live" | "Ongoing";

interface Product {
  id: string;
  title: string;
  tag: string;
  description: string;
  link: string;
  imageUrl?: string; // <-- Added Image URL
  status?: ProductStatus; // Live = shipped, Ongoing = in development
}

export default function ProductsAdmin() {
  const { can } = useAuth();
  const canWrite = can("products", "write");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [newProduct, setNewProduct] = useState({ title: "", tag: "SaaS", description: "", link: "", imageUrl: "", status: "Live" as ProductStatus });

  useEffect(() => {
    const q = query(collection(db, "products"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Product[]);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "products"), { ...newProduct, createdAt: serverTimestamp() });
      await logAction("Added product", newProduct.title);
      setShowModal(false);
      setNewProduct({ title: "", tag: "SaaS", description: "", link: "", imageUrl: "", status: "Live" });
    } catch (error) {
      console.error("Error adding product:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this product?")) {
      const removed = products.find((p) => p.id === id);
      await deleteDoc(doc(db, "products", id));
      await logAction("Deleted product", removed?.title || id);
    }
  };

  if (loading) return <Loader label="Loading products" sub="Fetching your storefront" />;

  return (
    <div className="font-['Inter',sans-serif] relative">
      <div className="flex justify-between items-end mb-8">
        <div>
          <div className="font-mono text-[12px] text-[#E5322B] tracking-[0.16em] uppercase font-medium flex items-center gap-2 mb-2">
            <span className="w-1.5 h-1.5 rounded-none bg-[#E5322B]"></span>
            Storefront
          </div>
          <h1 className="text-[32px] font-bold text-[#17222F] leading-none tracking-tight">Products</h1>
        </div>
        {canWrite && (
          <button onClick={() => setShowModal(true)} className="bg-[#17222F] text-white px-5 py-2.5 rounded-none font-semibold text-[14.5px] flex items-center gap-2 hover:-translate-y-0.5 transition-transform">
            <Plus size={18} /> Add Product
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {products.map((p) => (
          <div key={p.id} className="bg-[#FFFFFF] border border-[#17222F] rounded-none p-6 hover:border-[#E5322B] transition-colors flex flex-col">
            
            {/* Display Image Preview in Admin */}
            {p.imageUrl ? (
              <div className="w-full h-36 mb-5 rounded-none overflow-hidden border border-[#17222F]">
                <img src={p.imageUrl} alt={p.title} className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-full h-36 mb-5 rounded-none bg-[#F2F2F2] border border-[#17222F] flex items-center justify-center text-[#9AA0AD]">
                <ImageIcon size={32} opacity={0.5} />
              </div>
            )}

            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="bg-[#F2F2F2] text-[#E5322B] font-mono text-[11px] px-2.5 py-1 rounded-none-none uppercase tracking-wider font-semibold">
                  {p.tag}
                </span>
                <span className={`font-mono text-[11px] px-2.5 py-1 rounded-none-none uppercase tracking-wider font-semibold inline-flex items-center gap-1.5 ${
                  p.status === "Ongoing" ? "bg-[#FFF6E5] text-[#B7791F]" : "bg-[#E6F6EF] text-[#0F9D6B]"
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-none ${p.status === "Ongoing" ? "bg-[#F59E0B]" : "bg-[#0F9D6B] animate-pulse"}`} />
                  {p.status || "Live"}
                </span>
              </div>
              {canWrite && (
                <button onClick={() => handleDelete(p.id)} className="text-[#9AA0AD] hover:text-[#E5322B] transition-colors p-1">
                  <Trash2 size={16} />
                </button>
              )}
            </div>
            <h3 className="font-bold text-[#17222F] text-[19px] mb-2">{p.title}</h3>
            <p className="text-[#5A6473] text-[14.5px] mb-6 flex-1 line-clamp-3">{p.description}</p>
            <a href={p.link} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-[#E5322B] text-[14px] font-semibold hover:underline">
              View Link <ExternalLink size={14} />
            </a>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#17222F] bg-opacity-40 backdrop-blur-sm overflow-y-auto">
          <div className="bg-[#FFFFFF] w-full max-w-md border border-[#17222F] rounded-none overflow-hidden flex flex-col my-8">
            <div className="px-8 py-6 border-b border-[#17222F] flex justify-between items-center bg-[#FFFFFF]">
              <h2 className="text-[22px] font-bold text-[#17222F] leading-none">Add Product</h2>
              <button onClick={() => setShowModal(false)} className="w-8 h-8 flex items-center justify-center rounded-none bg-[#17222F] text-[#5A6473] hover:bg-[#17222F]">
                <X size={16} strokeWidth={2.5} />
              </button>
            </div>
            <form onSubmit={handleAddProduct} className="p-8 flex flex-col gap-5">
              
              {/* Image Preview inside Modal */}
              {newProduct.imageUrl && (
                <div className="w-full h-32 rounded-none overflow-hidden border border-[#17222F]">
                  <img src={newProduct.imageUrl} alt="Preview" className="w-full h-full object-cover" onError={(e) => e.currentTarget.style.display = 'none'} />
                </div>
              )}

              <div>
                <label className="block font-mono text-[12px] text-[#5A6473] mb-[7px]">Image URL</label>
                <input type="url" value={newProduct.imageUrl} onChange={(e) => setNewProduct({...newProduct, imageUrl: e.target.value})} placeholder="https://example.com/image.png" className="w-full px-[14px] py-[13px] rounded-none border border-[#17222F] bg-[#FFFFFF] text-[#17222F] focus:border-[#E5322B] outline-none" />
              </div>

              <div>
                <label className="block font-mono text-[12px] text-[#5A6473] mb-[7px]">Product Title</label>
                <input type="text" value={newProduct.title} onChange={(e) => setNewProduct({...newProduct, title: e.target.value})} required className="w-full px-[14px] py-[13px] rounded-none border border-[#17222F] bg-[#FFFFFF] text-[#17222F] focus:border-[#E5322B] outline-none" />
              </div>
              <div>
                <label className="block font-mono text-[12px] text-[#5A6473] mb-[7px]">Tag / Category</label>
                <input type="text" value={newProduct.tag} onChange={(e) => setNewProduct({...newProduct, tag: e.target.value})} placeholder="e.g. SaaS, Template, Toolkit" required className="w-full px-[14px] py-[13px] rounded-none border border-[#17222F] bg-[#FFFFFF] text-[#17222F] focus:border-[#E5322B] outline-none" />
              </div>

              <div>
                <label className="block font-mono text-[12px] text-[#5A6473] mb-[7px]">Status</label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { value: "Live", desc: "Shipped & available", color: "#0F9D6B", wash: "#E6F6EF" },
                    { value: "Ongoing", desc: "In development", color: "#F59E0B", wash: "#FFF6E5" },
                  ] as const).map((opt) => {
                    const active = newProduct.status === opt.value;
                    return (
                      <button type="button" key={opt.value} onClick={() => setNewProduct({ ...newProduct, status: opt.value })}
                        className="text-left px-3.5 py-2.5 rounded-none border transition-colors"
                        style={{ borderColor: active ? opt.color : "#17222F", background: active ? opt.wash : "#FFFFFF" }}>
                        <div className="font-semibold text-[14px] flex items-center gap-2" style={{ color: active ? opt.color : "#17222F" }}>
                          <span className="w-2 h-2 rounded-none" style={{ background: opt.color }} /> {opt.value}
                        </div>
                        <div className="text-[12px] text-[#9AA0AD] mt-0.5">{opt.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="block font-mono text-[12px] text-[#5A6473] mb-[7px]">Description</label>
                <textarea value={newProduct.description} onChange={(e) => setNewProduct({...newProduct, description: e.target.value})} required rows={3} className="w-full px-[14px] py-[13px] rounded-none border border-[#17222F] bg-[#FFFFFF] text-[#17222F] focus:border-[#E5322B] outline-none" />
              </div>
              <div>
                <label className="block font-mono text-[12px] text-[#5A6473] mb-[7px]">External Link (URL)</label>
                <input type="url" value={newProduct.link} onChange={(e) => setNewProduct({...newProduct, link: e.target.value})} placeholder="https://" required className="w-full px-[14px] py-[13px] rounded-none border border-[#17222F] bg-[#FFFFFF] text-[#17222F] focus:border-[#E5322B] outline-none" />
              </div>
              <button type="submit" disabled={isSubmitting} className="mt-2 bg-[#17222F] text-white font-semibold py-[15px] rounded-none hover:-translate-y-[2px] transition-transform disabled:opacity-70">
                {isSubmitting ? "Saving..." : "Publish Product"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}