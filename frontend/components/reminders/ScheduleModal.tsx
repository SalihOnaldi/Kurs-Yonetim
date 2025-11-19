"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import api from "@/lib/api";

interface ScheduleModalProps {
  open: boolean;
  onClose: () => void;
  onScheduled: () => void;
  initialStudent?: {
    id: number;
    name: string;
    email?: string | null;
    phone?: string | null;
  };
  initialDocument?: {
    id: number;
    documentType: string;
    docDate?: string | null;
  };
}

interface StudentSearchResult {
  id: number;
  tcKimlikNo: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  email?: string | null;
}

interface StudentDocumentOption {
  id: number;
  documentType: string;
  docDate?: string | null;
}

interface StudentDetailResponse {
  profile: {
    id: number;
    firstName: string;
    lastName: string;
    email?: string | null;
    phone?: string | null;
  };
  documents: StudentDocumentOption[];
}

export default function ScheduleModal({
  open,
  onClose,
  onScheduled,
  initialStudent,
  initialDocument,
}: ScheduleModalProps) {
  const [studentQuery, setStudentQuery] = useState("");
  const [studentSearchResults, setStudentSearchResults] = useState<StudentSearchResult[]>([]);
  const [studentSearchLoading, setStudentSearchLoading] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<ScheduleModalProps["initialStudent"] | null>(
    initialStudent ?? null
  );
  const [documents, setDocuments] = useState<StudentDocumentOption[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState<number | null>(
    initialDocument?.id ?? null
  );
  const [scheduledAt, setScheduledAt] = useState<string>(() =>
    new Date(Date.now() + 3600 * 1000).toISOString().slice(0, 16)
  );
  const [channel, setChannel] = useState<"email" | "sms" | "both">("both");
  const [title, setTitle] = useState<string>(
    initialDocument
      ? `${initialDocument.documentType} belgeniz için hatırlatma`
      : "Belge hatırlatma"
  );
  const [message, setMessage] = useState<string>(
    initialDocument?.docDate
      ? `Belgenizin son geçerlilik tarihi ${new Date(initialDocument.docDate).toLocaleDateString(
          "tr-TR"
        )}. Lütfen zamanında yenileyin.`
      : "Belge işlemlerinizi tamamlamayı unutmayın."
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setError("");
      setStudentQuery("");
      setStudentSearchResults([]);
      if (initialStudent) {
        setSelectedStudent(initialStudent);
      }
      if (initialDocument) {
        setSelectedDocumentId(initialDocument.id);
      }
      if (initialDocument?.docDate) {
        setScheduledAt(new Date(new Date(initialDocument.docDate).getTime() - 7 * 24 * 3600 * 1000)
          .toISOString()
          .slice(0, 16));
      }
    } else {
      setSelectedStudent(initialStudent ?? null);
      setDocuments([]);
      setSelectedDocumentId(initialDocument?.id ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    const abort = new AbortController();
    if (!selectedStudent) {
      setDocuments([]);
      setSelectedDocumentId(initialDocument?.id ?? null);
      return () => abort.abort();
    }

    api
      .get<StudentDetailResponse>(`/students/${selectedStudent.id}`, {
        signal: abort.signal,
      })
      .then((response) => {
        setDocuments(response.data.documents || []);
        if (initialDocument) {
          setSelectedDocumentId(initialDocument.id);
        }
      })
      .catch((err) => {
        if (!abort.signal.aborted) {
          console.error("Student detail load error:", err);
          setError(
            err.response?.data?.message ||
              err.message ||
              "Kursiyer belgeleri yüklenirken hata oluştu."
          );
        }
      });

    return () => abort.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStudent?.id]);

  const handleStudentSearch = async () => {
    const term = studentQuery.trim();
    if (!term) {
      setError("Arama yapmak için kursiyer adı, soyadı veya TCKN girin.");
      return;
    }
    setError("");
    setStudentSearchLoading(true);
    try {
      const response = await api.get<StudentSearchResult[]>(`/students?search=${encodeURIComponent(term)}`);
      setStudentSearchResults(response.data || []);
    } catch (err: any) {
      console.error("Student search error:", err);
      setError(
        err.response?.data?.message ||
          err.message ||
          "Kursiyer araması sırasında bir hata oluştu."
      );
    } finally {
      setStudentSearchLoading(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedStudent) {
      setError("Lütfen bir kursiyer seçin.");
      return;
    }
    if (!selectedDocumentId) {
      setError("Lütfen bir belge seçin.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      await api.post("/reminders", {
        studentId: selectedStudent.id,
        studentDocumentId: selectedDocumentId,
        channel,
        title,
        message,
        scheduledAt: new Date(scheduledAt).toISOString(),
      });
      onScheduled();
      onClose();
    } catch (err: any) {
      console.error("Reminder create error:", err);
      setError(
        err.response?.data?.message ||
          err.message ||
          "Hatırlatma planlanırken bir hata oluştu."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const selectedDocument = useMemo(
    () => documents.find((doc) => doc.id === selectedDocumentId) ?? initialDocument ?? null,
    [documents, selectedDocumentId, initialDocument]
  );

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full">
        <div className="px-6 py-4 border-b border-emerald-100 flex justify-between items-center">
          <h2 className="text-xl font-bold text-emerald-900 flex items-center gap-2">
            <span className="text-2xl">🔔</span>
            Hatırlatma Planla
          </h2>
          <button
            onClick={onClose}
            className="text-emerald-400 hover:text-emerald-600 text-2xl leading-none"
            aria-label="Kapat"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <section className="space-y-4">
            <header>
              <h3 className="text-lg font-semibold text-emerald-900">Kursiyer Bilgileri</h3>
              <p className="text-sm text-emerald-600">
                Hatırlatma gönderilecek kursiyeri seçin. Gerekirse arama yaparak yeni kursiyer seçebilirsiniz.
              </p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Kursiyer Ara</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={studentQuery}
                    onChange={(event) => setStudentQuery(event.target.value)}
                    placeholder="Ad, soyad veya TCKN"
                    className="flex-1 px-4 py-2 border-2 border-emerald-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={handleStudentSearch}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium disabled:opacity-60"
                    disabled={studentSearchLoading || !studentQuery.trim()}
                  >
                    {studentSearchLoading ? "Aranıyor..." : "Ara"}
                  </button>
                </div>
                {studentSearchResults.length > 0 && (
                  <div className="border border-dashed border-emerald-200 rounded-xl overflow-hidden max-h-40 overflow-y-auto">
                    {studentSearchResults.map((student) => (
                      <button
                        key={student.id}
                        type="button"
                        onClick={() => {
                          setSelectedStudent({
                            id: student.id,
                            name: `${student.firstName} ${student.lastName}`,
                            email: student.email,
                            phone: student.phone,
                          });
                          setStudentSearchResults([]);
                          setStudentQuery("");
                        }}
                        className="w-full text-left px-4 py-2 text-sm hover:bg-emerald-100"
                      >
                        <div className="font-semibold text-emerald-900">
                          {student.firstName} {student.lastName}
                        </div>
                        <div className="text-xs text-emerald-600">
                          {student.tcKimlikNo} • {student.email || "-"} • {student.phone || "-"}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="px-4 py-3 border border-emerald-100 rounded-xl bg-emerald-50">
                {selectedStudent ? (
                  <div className="text-sm text-emerald-900">
                    <div className="font-semibold">{selectedStudent.name}</div>
                    <div className="text-xs text-emerald-700">
                      {selectedStudent.email || "E-posta yok"} • {selectedStudent.phone || "Telefon yok"}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-emerald-700">
                    Henüz kursiyer seçmediniz. Arama yaparak bir kursiyer seçin.
                  </p>
                )}
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <header>
              <h3 className="text-lg font-semibold text-emerald-900">Belge ve Hatırlatma Bilgileri</h3>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Belge Seçimi</label>
                <select
                  value={selectedDocumentId ?? ""}
                  onChange={(event) => setSelectedDocumentId(event.target.value ? Number(event.target.value) : null)}
                  className="w-full px-4 py-2 border-2 border-emerald-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Belge seçin</option>
                  {documents.map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      {doc.documentType} • {doc.docDate ? new Date(doc.docDate).toLocaleDateString("tr-TR") : "Tarih yok"}
                    </option>
                  ))}
                </select>
                {!documents.length && (
                  <p className="text-xs text-gray-500 mt-2">
                    Seçtiğiniz kursiyerin belge bilgileri bulunamadı. Önce belge yüklemeniz gerekebilir.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Hatırlatma Zamanı</label>
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(event) => setScheduledAt(event.target.value)}
                  className="w-full px-4 py-2 border-2 border-emerald-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Bu tarih ve saatte hatırlatma gönderilecektir. Geçmiş bir tarih seçilirse hatırlatma birkaç dakika içinde gönderilir.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Başlık</label>
                <input
                  type="text"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className="w-full px-4 py-2 border-2 border-emerald-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Kanal</label>
                <select
                  value={channel}
                  onChange={(event) => setChannel(event.target.value as typeof channel)}
                  className="w-full px-4 py-2 border-2 border-emerald-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="both">E-posta + SMS</option>
                  <option value="email">Yalnızca E-posta</option>
                  <option value="sms">Yalnızca SMS</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Mesaj</label>
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                rows={4}
                className="w-full px-4 py-3 border-2 border-emerald-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {selectedDocument && selectedDocument.docDate && (
              <div className="px-4 py-3 bg-emerald-50 border border-emerald-100 rounded-xl text-sm text-emerald-800">
                <strong>{selectedDocument.documentType}</strong> belgesinin bitiş tarihi{" "}
                {new Date(selectedDocument.docDate).toLocaleDateString("tr-TR")} olarak görünüyor. Planlanan hatırlatma:
                {new Date(scheduledAt).toLocaleString("tr-TR")}.
              </div>
            )}
          </section>

          <div className="flex justify-end gap-3 pt-4 border-t border-emerald-100">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 border-2 border-emerald-200 text-emerald-700 rounded-lg hover:bg-emerald-50 font-medium transition"
              disabled={submitting}
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-green-600 text-white rounded-lg hover:from-emerald-700 hover:to-green-700 font-medium shadow-md disabled:opacity-60"
            >
              {submitting ? "Planlanıyor..." : "Hatırlatmayı Kaydet"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


