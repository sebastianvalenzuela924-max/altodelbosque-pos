
"use client";

import { useState } from "react";
import { useCollection, useFirestore, useMemoFirebase, addDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase";
import { collection, query, orderBy, doc, serverTimestamp } from "firebase/firestore";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Notebook, Plus, Trash2, Clock, StickyNote, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function NotesPage() {
  const [newNote, setNewNote] = useState("");
  const firestore = useFirestore();
  const { toast } = useToast();

  const notesQuery = useMemoFirebase(() => {
    return query(collection(firestore, "notes"), orderBy("createdAt", "desc"));
  }, [firestore]);

  const { data: notes, isLoading } = useCollection(notesQuery);

  const handleAddNote = () => {
    if (!newNote.trim()) return;
    
    const notesRef = collection(firestore, "notes");
    addDocumentNonBlocking(notesRef, {
      content: newNote.trim(),
      createdAt: serverTimestamp()
    });
    
    setNewNote("");
    toast({ title: "Nota agregada", description: "El recado se ha guardado correctamente." });
  };

  const handleDeleteNote = (id: string) => {
    const noteRef = doc(firestore, "notes", id);
    deleteDocumentNonBlocking(noteRef);
    toast({ title: "Nota eliminada", description: "El recado ha sido borrado." });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-primary flex items-center gap-2">
            <Notebook className="w-8 h-8" />
            Recados y Notas
          </h1>
          <p className="text-muted-foreground">Deja recordatorios para el terminal o para pedir stock.</p>
        </div>
      </div>

      <Card className="border-none shadow-xl rounded-3xl overflow-hidden bg-white">
        <CardContent className="p-6">
          <div className="flex gap-2">
            <Input 
              placeholder="Escribe un recado... (ej: falta pedir Coca Cola 1.5L)" 
              className="h-14 rounded-2xl bg-slate-50 border-none font-bold text-lg focus-visible:ring-primary shadow-inner"
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddNote()}
            />
            <Button 
              className="h-14 w-14 rounded-2xl bg-primary hover:bg-primary/90 shrink-0 shadow-lg shadow-primary/20"
              onClick={handleAddNote}
              disabled={!newNote.trim()}
            >
              <Plus className="w-6 h-6" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 opacity-30">
            <Loader2 className="w-12 h-12 animate-spin mb-2" />
            <p className="font-bold uppercase text-[10px] tracking-widest">Cargando notas...</p>
          </div>
        ) : !notes || notes.length === 0 ? (
          <div className="text-center py-32 bg-white rounded-3xl shadow-inner border-2 border-dashed border-slate-200">
            <StickyNote className="w-16 h-16 mx-auto mb-4 text-slate-200" />
            <h3 className="text-xl font-bold text-slate-400 uppercase tracking-widest">No hay notas</h3>
            <p className="text-slate-400">Escribe algo arriba para no olvidarlo.</p>
          </div>
        ) : (
          notes.map((note) => {
            const date = note.createdAt?.toDate?.() || new Date();
            return (
              <Card key={note.id} className="border-none shadow-md hover:shadow-lg transition-all duration-300 rounded-2xl bg-white group overflow-hidden">
                <CardContent className="p-0">
                  <div className="flex">
                    <div className="bg-primary/5 p-4 flex flex-col justify-center items-center border-r border-slate-100 min-w-[80px]">
                      <Clock className="w-4 h-4 text-primary/40 mb-1" />
                      <span className="text-[10px] font-black text-primary/60 uppercase">
                        {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="flex-1 p-5 flex items-center justify-between">
                      <div>
                        <p className="text-slate-700 font-bold text-lg leading-tight">{note.content}</p>
                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">
                          {date.toLocaleDateString()}
                        </p>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="text-destructive transition-opacity rounded-full hover:bg-destructive/10"
                        onClick={() => handleDeleteNote(note.id)}
                      >
                        <Trash2 className="w-5 h-5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
