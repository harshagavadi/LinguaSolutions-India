import { ArrowRightLeft, Copy, Loader2, Download, X, Paperclip, FileText, Mic, MicOff, History, Trash2, Search, Star, Image as ImageIcon, Upload, Sparkles, Settings, Check, RotateCcw, Wifi, WifiOff, Database, DownloadCloud, HardDriveDownload, FileSpreadsheet, FileOutput, Table, Volume2, VolumeX } from 'lucide-react';
import React, { useEffect, useState, useRef } from 'react';
import { LANGUAGES } from '../constants/languages';
import { useDebounce } from '../hooks/useDebounce';
import { translateContent, type TranslationOptions } from '../services/geminiService';
import { franc } from 'franc-min';
import { ISO6393_TO_NAME } from '../utils/languageMap';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';

interface HistoryItem {
  id: string;
  sourceText: string;
  translatedText: string;
  sourceLang: string;
  targetLang: string;
  timestamp: number;
}

interface SavedItem extends HistoryItem {}

const enhanceImageForOCR = (dataUrl: string, ocrContrast: number, ocrSharpen: boolean): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }

      // Scaling up can sometimes help OCR
      const scale = img.width < 1000 ? 2 : 1;
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // 1. Grayscale Conversion
      for (let i = 0; i < data.length; i += 4) {
        const grayscale = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
        data[i] = data[i+1] = data[i+2] = grayscale;
      }

      // 2. Conditional Sharpening (3x3 Kernel)
      if (ocrSharpen) {
        const kernel = [
           0, -1,  0,
          -1,  5, -1,
           0, -1,  0
        ];
        const side = Math.round(Math.sqrt(kernel.length));
        const halfSide = Math.floor(side / 2);
        const output = new Uint8ClampedArray(data.length);

        for (let y = 0; y < canvas.height; y++) {
          for (let x = 0; x < canvas.width; x++) {
            const dstOff = (y * canvas.width + x) * 4;
            let r = 0, g = 0, b = 0;
            for (let ky = 0; ky < side; ky++) {
              for (let kx = 0; kx < side; kx++) {
                const scy = y + ky - halfSide;
                const scx = x + kx - halfSide;
                if (scy >= 0 && scy < canvas.height && scx >= 0 && scx < canvas.width) {
                  const srcOff = (scy * canvas.width + scx) * 4;
                  const wt = kernel[ky * side + kx];
                  r += data[srcOff] * wt;
                  g += data[srcOff+1] * wt;
                  b += data[srcOff+2] * wt;
                }
              }
            }
            output[dstOff] = Math.min(255, Math.max(0, r));
            output[dstOff+1] = Math.min(255, Math.max(0, g));
            output[dstOff+2] = Math.min(255, Math.max(0, b));
            output[dstOff+3] = data[dstOff+3];
          }
        }
        data.set(output);
      }

      // 3. Contrast Enhancement & Binarization (Thresholding)
      // factor = (259 * (contrast + 255)) / (255 * (259 - contrast))
      const factor = (259 * (ocrContrast + 255)) / (255 * (259 - ocrContrast));
      
      for (let i = 0; i < data.length; i += 4) {
        let val = data[i];
        
        // Apply contrast
        val = factor * (val - 128) + 128;
        
        // Thresholding
        const result = val > 128 ? 255 : 0;
        data[i] = data[i+1] = data[i+2] = result;
      }

      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL('image/png')); // PNG preferred for sharp text
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
};

export function Translator() {
  const [sourceLang, setSourceLang] = useState('Auto-Detect');
  const [targetLang, setTargetLang] = useState('Spanish');
  const [sourceText, setSourceText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [savedTranslations, setSavedTranslations] = useState<SavedItem[]>([]);
  const [activeTab, setActiveTab] = useState<'history' | 'saved'>('history');
  const [detectedLang, setDetectedLang] = useState<string | null>(null);
  
  const [fileData, setFileData] = useState<{mimeType: string, data: string, name: string} | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [fileQueue, setFileQueue] = useState<File[]>([]);
  const [currentFileIndex, setCurrentFileIndex] = useState<number | null>(null);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);
  const [isBatchTranslating, setIsBatchTranslating] = useState(false);
  const [batchResults, setBatchResults] = useState<{name: string, translatedText: string}[]>([]);
  const [processedFiles, setProcessedFiles] = useState<{name: string, mimeType: string, data: string, preview: string | null}[]>([]);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const toggleSpeech = () => {
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    if (!translatedText) return;

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(translatedText);
    
    // Set language (attempt to match target language code)
    const targetLangCode = LANGUAGES.find(l => l.name === targetLang)?.code || 'en-US';
    utterance.lang = targetLangCode;
    
    // Appy settings
    utterance.rate = settings.voiceConfig?.rate ?? 1;
    utterance.pitch = settings.voiceConfig?.pitch ?? 1;

    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    utterance.onstart = () => setIsSpeaking(true);

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<TranslationOptions>({
    tone: 'neutral',
    format: 'text',
    mode: 'natural',
    offlineMode: false,
    highPrecisionOCR: true,
    enhanceImage: false,
    ocrSharpen: true,
    ocrContrast: 50,
    voiceConfig: {
      continuous: true,
      sensitivity: 80,
      model: 'enhanced',
      rate: 1,
      pitch: 1
    }
  });
  const [downloadedPacks, setDownloadedPacks] = useState<string[]>([]);
  const [isDownloading, setIsDownloading] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const readerRef = useRef<FileReader | null>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  
  const debouncedSourceText = useDebounce(sourceText, 600);
  
  // Online/Offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Simulation of downloading language pack
  const downloadPack = (langName: string) => {
    if (isDownloading || downloadedPacks.includes(langName)) return;
    
    setIsDownloading(langName);
    setDownloadProgress(0);
    
    const interval = setInterval(() => {
      setDownloadProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setDownloadedPacks(d => [...d, langName]);
          setIsDownloading(null);
          return 100;
        }
        return prev + Math.floor(Math.random() * 15) + 5;
      });
    }, 400);
  };

  const removePack = (langName: string) => {
    setDownloadedPacks(d => d.filter(p => p !== langName));
  };

  // Close settings when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setShowSettings(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Language detection effect
  useEffect(() => {
    if (sourceLang === 'Auto-Detect' && debouncedSourceText.trim().length > 3) {
      const langCode = franc(debouncedSourceText);
      const langName = ISO6393_TO_NAME[langCode];
      if (langName) {
        setDetectedLang(langName);
      } else {
        setDetectedLang(null);
      }
    } else {
      setDetectedLang(null);
    }
  }, [debouncedSourceText, sourceLang]);

  // Load history from localStorage
  useEffect(() => {
    const savedHistory = localStorage.getItem('translation_history');
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error('Failed to parse history', e);
      }
    }
    const savedSaved = localStorage.getItem('saved_translations');
    if (savedSaved) {
      try {
        setSavedTranslations(JSON.parse(savedSaved));
      } catch (e) {
        console.error('Failed to parse saved items', e);
      }
    }
    const savedSettings = localStorage.getItem('translation_settings');
    if (savedSettings) {
      try {
        setSettings(JSON.parse(savedSettings));
      } catch (e) {
        console.error('Failed to parse settings', e);
      }
    }
    const savedPacks = localStorage.getItem('downloaded_packs');
    if (savedPacks) {
      try {
        setDownloadedPacks(JSON.parse(savedPacks));
      } catch (e) {
        console.error('Failed to parse packs', e);
      }
    }
  }, []);

  // Save data to localStorage
  useEffect(() => {
    localStorage.setItem('translation_history', JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    localStorage.setItem('saved_translations', JSON.stringify(savedTranslations));
  }, [savedTranslations]);

  useEffect(() => {
    localStorage.setItem('translation_settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem('downloaded_packs', JSON.stringify(downloadedPacks));
  }, [downloadedPacks]);

  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = settings.voiceConfig?.continuous ?? true;
      recognitionRef.current.interimResults = true;

      recognitionRef.current.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0])
          .map((result: any) => result.transcript)
          .join('');
        setSourceText(transcript);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, []);

  // Sync voice settings to recognition instance
  useEffect(() => {
    if (recognitionRef.current) {
      recognitionRef.current.continuous = settings.voiceConfig?.continuous ?? true;
    }
  }, [settings.voiceConfig?.continuous]);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      setError('Speech recognition is not supported in this browser.');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.error('Start listening error:', err);
      }
    }
  };

  useEffect(() => {
    async function performTranslation() {
      if (!debouncedSourceText.trim() && !fileData) {
        setTranslatedText('');
        setError(null);
        return;
      }

      setIsTranslating(true);
      setError(null);

      // Offline Mode Logic
      if (settings.offlineMode) {
        if (!downloadedPacks.includes(targetLang)) {
            setError(`Language pack for ${targetLang} is not downloaded. Check settings.`);
            setIsTranslating(false);
            return;
        }

        if (!isOnline) {
            // Truly offline: search history for exact match
            const match = history.find(h => 
                h.sourceText.toLowerCase() === debouncedSourceText.trim().toLowerCase() && 
                h.targetLang === targetLang
            );
            if (match) {
                setTranslatedText(match.translatedText);
                setIsTranslating(false);
                return;
            } else {
                setError("No offline translation found for this text. Connect to translate new content.");
                setIsTranslating(false);
                return;
            }
        }
      }

      try {
        const effectiveSourceLang = (sourceLang === 'Auto-Detect' && detectedLang) ? detectedLang : sourceLang;
        const result = await translateContent(debouncedSourceText, effectiveSourceLang, targetLang, fileData, settings);
        setTranslatedText(result);
        
        // Add to history if text is substantial and not already top of history
        if (debouncedSourceText.trim().length > 2 && result) {
          setHistory(prev => {
            const newItem: HistoryItem = {
              id: Date.now().toString(),
              sourceText: debouncedSourceText.trim(),
              translatedText: result,
              sourceLang: effectiveSourceLang,
              targetLang,
              timestamp: Date.now()
            };
            // Prevent duplicates at the top
            if (prev.length > 0 && prev[0].sourceText === newItem.sourceText && prev[0].targetLang === newItem.targetLang) {
              return prev;
            }
            return [newItem, ...prev].slice(0, 50); // Keep last 50
          });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setIsTranslating(false);
      }
    }

    performTranslation();
  }, [debouncedSourceText, sourceLang, targetLang, fileData]);

  const handleSwapLanguages = () => {
    setSourceLang(targetLang);
    setTargetLang(sourceLang);
  };

  const copyToClipboard = async (text: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };
  
  const processQueue = async (queue: File[]) => {
    if (queue.length === 0) return;
    
    setIsProcessingQueue(true);
    const newProcessedFiles: {name: string, mimeType: string, data: string, preview: string | null}[] = [];
    
    for (let i = 0; i < queue.length; i++) {
        setCurrentFileIndex(i);
        const file = queue[i];
        
        try {
            const result = await new Promise<{base64: string, preview: string | null}>((resolve, reject) => {
                const reader = new FileReader();
                readerRef.current = reader;
                
                reader.onprogress = (event) => {
                    if (event.lengthComputable) {
                        const progress = Math.round((event.loaded / event.total) * 100);
                        setUploadProgress(progress);
                    }
                };

                reader.onloadstart = () => {
                    setUploadProgress(0);
                    setError(null);
                };

                reader.onload = async () => {
                    let base64 = "";
                    let preview: string | null = null;
                    
                    if (file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || file.type === 'application/vnd.ms-excel') {
                      try {
                        const data = new Uint8Array(reader.result as ArrayBuffer);
                        const workbook = XLSX.read(data, { type: 'array' });
                        const firstSheetName = workbook.SheetNames[0];
                        const worksheet = workbook.Sheets[firstSheetName];
                        const content = XLSX.utils.sheet_to_txt(worksheet);
                        base64 = btoa(content);
                      } catch (err) {
                        console.error('Excel parsing error:', err);
                        reject(new Error("Failed to parse Excel file."));
                        return;
                      }
                    } else {
                      let dataUrl = reader.result as string;
                      
                      if (file.type.startsWith('image/') && settings.enhanceImage) {
                         dataUrl = await enhanceImageForOCR(dataUrl, settings.ocrContrast ?? 50, settings.ocrSharpen ?? true);
                      }
                      
                      base64 = dataUrl.split(',')[1];
                      if (file.type.startsWith('image/') || file.type === 'application/pdf') {
                        preview = dataUrl;
                      }
                    }
                    
                    resolve({ base64, preview });
                };

                reader.onerror = () => reject(new Error(`Failed to read ${file.name}.`));
                reader.onabort = () => reject(new Error('Upload cancelled'));

                if (file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || file.type === 'application/vnd.ms-excel') {
                  reader.readAsArrayBuffer(file);
                } else {
                  reader.readAsDataURL(file);
                }
            });

            const fileEntry = {
              name: file.name,
              mimeType: file.type,
              data: result.base64,
              preview: result.preview
            };

            newProcessedFiles.push(fileEntry);
            
            // Still set the last file as "active" for immediate feedback
            setFileData(fileEntry);
            setFilePreview(result.preview);

        } catch (err) {
            console.error(err);
            if (err instanceof Error && err.message === 'Upload cancelled') {
                break;
            }
            setError(err instanceof Error ? err.message : "Error processing file");
        }
    }
    
    setProcessedFiles(prev => [...prev, ...newProcessedFiles]);
    setFileQueue([]);
    setCurrentFileIndex(null);
    setIsProcessingQueue(false);
    readerRef.current = null;
    setUploadProgress(null);
  };

  const handleBatchTranslate = async () => {
    if (processedFiles.length === 0) return;
    
    setIsBatchTranslating(true);
    setError(null);
    const results: {name: string, translatedText: string}[] = [];
    
    try {
      for (const file of processedFiles) {
        const result = await translateContent("", sourceLang, targetLang, file, settings);
        results.push({ name: file.name, translatedText: result });
      }
      setBatchResults(results);
    } catch (err) {
      console.error('Batch translation error:', err);
      setError("Batch translation partially failed. Check results.");
    } finally {
      setIsBatchTranslating(false);
    }
  };

  const cancelUpload = () => {
    if (readerRef.current) {
        readerRef.current.abort();
    }
    setFileQueue([]);
    setCurrentFileIndex(null);
    setIsProcessingQueue(false);
    setUploadProgress(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length === 0) return;

    const validFiles = files.filter(file => {
        if (file.size > 20 * 1024 * 1024) {
            setError(`"${file.name}" is too large (max 20MB).`);
            return false;
        }
        return true;
    });

    if (validFiles.length > 0) {
        setFileQueue(validFiles);
        processQueue(validFiles);
    }
  };

  const clearFile = () => {
    setFileData(null);
    setFilePreview(null);
    setUploadProgress(null);
    setShowClearConfirm(false);
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  };

  const handleClearRequest = () => {
    if (fileData) {
      setShowClearConfirm(true);
    } else {
      clearFile();
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files || []) as File[];
    if (files.length > 0) {
        const validFiles = files.filter(file => {
            if (file.size > 20 * 1024 * 1024) {
                setError(`"${file.name}" is too large (max 20MB).`);
                return false;
            }
            return true;
        });

        if (validFiles.length > 0) {
            setFileQueue(validFiles);
            processQueue(validFiles);
        }
    }
  };

  const handleDownloadDoc = () => {
    if (!translatedText) return;
    
    const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Translated Document</title></head><body>";
    const footer = "</body></html>";
    
    const content = translatedText.split('\n').map(line => `<p>${line}</p>`).join('');
    const html = header + content + footer;
    
    const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `LinguaSolutions_${targetLang}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadPDF = () => {
    if (!translatedText) return;
    const doc = new jsPDF();
    
    // Simple text wrapping for PDF
    const splitText = doc.splitTextToSize(translatedText, 180);
    doc.text(splitText, 10, 10);
    doc.save(`Translation_${targetLang}.pdf`);
  };

  const handleDownloadExcel = () => {
    if (!translatedText) return;
    
    const lines = translatedText.split('\n').filter(l => l.trim());
    const data = lines.map(line => ({ "Translated Content": line }));
    
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Translation");
    
    XLSX.writeFile(workbook, `Translation_${targetLang}.xlsx`);
  };

  const handleDownloadCSV = () => {
    if (!translatedText) return;
    
    const lines = translatedText.split('\n').filter(l => l.trim());
    const data = lines.map(line => ({ "Translated Content": line }));
    
    const worksheet = XLSX.utils.json_to_sheet(data);
    const csv = XLSX.utils.sheet_to_csv(worksheet);
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Translation_${targetLang}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadSmart = () => {
    if (!fileData) {
      handleDownloadDoc();
      return;
    }

    if (fileData.mimeType.includes('pdf')) {
      handleDownloadPDF();
    } else if (fileData.mimeType.includes('sheet') || fileData.mimeType.includes('excel')) {
      handleDownloadExcel();
    } else if (fileData.mimeType.includes('csv')) {
      handleDownloadCSV();
    } else {
      handleDownloadDoc();
    }
  };

  const getMatchedFormatInfo = () => {
    if (!fileData) return null;
    if (fileData.mimeType.includes('pdf')) return { name: 'PDF Document', icon: <FileOutput className="w-4 h-4 text-red-500" /> };
    if (fileData.mimeType.includes('sheet') || fileData.mimeType.includes('excel')) return { name: 'Excel Sheet', icon: <FileSpreadsheet className="w-4 h-4 text-green-500" /> };
    if (fileData.mimeType.includes('csv')) return { name: 'CSV Document', icon: <Table className="w-4 h-4 text-blue-400" /> };
    return { name: 'Word Document', icon: <FileText className="w-4 h-4 text-blue-500" /> };
  };

  const matchedFormat = getMatchedFormatInfo();

  const [showExportOptions, setShowExportOptions] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(event.target as Node)) {
        setShowExportOptions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleDownloadConsolidatedPDF = () => {
    if (batchResults.length === 0) return;
    const doc = new jsPDF();
    let currentY = 10;
    
    batchResults.forEach((result, index) => {
      if (index > 0) {
        doc.addPage();
        currentY = 10;
      }
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text(result.name, 10, currentY);
      currentY += 10;
      
      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      const splitText = doc.splitTextToSize(result.translatedText, 180);
      doc.text(splitText, 10, currentY);
    });
    
    doc.save(`Batch_Translation_${targetLang}.pdf`);
  };

  const handleDownloadConsolidatedExcel = () => {
    if (batchResults.length === 0) return;
    
    const data = batchResults.map(result => ({
      "File Name": result.name,
      "Translation": result.translatedText
    }));
    
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Batch Translation");
    
    XLSX.writeFile(workbook, `Batch_Translation_${targetLang}.xlsx`);
  };

  const handleDownloadConsolidatedCSV = () => {
    if (batchResults.length === 0) return;
    
    const data = batchResults.map(result => ({
      "File Name": result.name,
      "Translation": result.translatedText
    }));
    
    const worksheet = XLSX.utils.json_to_sheet(data);
    const csv = XLSX.utils.sheet_to_csv(worksheet);
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Batch_Translation_${targetLang}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const clearBatch = () => {
    setBatchResults([]);
    setProcessedFiles([]);
  };

  const restoreHistory = (item: HistoryItem) => {
    setSourceLang(item.sourceLang);
    setTargetLang(item.targetLang);
    setSourceText(item.sourceText);
    setTranslatedText(item.translatedText);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const deleteHistoryItem = (id: string) => {
    setHistory(prev => prev.filter(item => item.id !== id));
  };

  const clearHistory = () => {
    if (confirm('Are you sure you want to clear all translation history?')) {
      setHistory([]);
    }
  };

  const toggleSaveCurrent = () => {
    if (!translatedText || !sourceText.trim()) return;
    
    const isAlreadySaved = savedTranslations.find(s => s.sourceText === sourceText.trim() && s.targetLang === targetLang);
    
    if (isAlreadySaved) {
      setSavedTranslations(prev => prev.filter(s => s.id !== isAlreadySaved.id));
    } else {
      const newItem: SavedItem = {
        id: Date.now().toString(),
        sourceText: sourceText.trim(),
        translatedText,
        sourceLang: (sourceLang === 'Auto-Detect' && detectedLang) ? detectedLang : sourceLang,
        targetLang,
        timestamp: Date.now()
      };
      setSavedTranslations(prev => [newItem, ...prev]);
      setActiveTab('saved');
    }
  };

  const isCurrentSaved = savedTranslations.some(s => s.sourceText === sourceText.trim() && s.targetLang === targetLang);

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-8">
      {/* Branding Header */}
      <div className="flex flex-col items-center mb-12 animate-in fade-in slide-in-from-top-4 duration-700">
        <div className="flex items-center gap-3 mb-2">
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl blur opacity-25 group-hover:opacity-100 transition duration-1000 group-hover:duration-200" />
            <div className="relative p-3 bg-white rounded-2xl shadow-xl border border-gray-100">
              <Sparkles className="w-8 h-8 text-blue-600 animate-pulse" />
            </div>
          </div>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
              Vocal<span className="text-blue-600">Sync</span>
            </h1>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Human-Grade AI Intelligence</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-2 p-2 bg-transparent">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1 bg-white rounded-full border border-gray-100 shadow-sm transition-all">
             <div className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'} ${isOnline ? 'animate-pulse' : ''}`} />
             <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{isOnline ? 'Online' : 'Offline'}</span>
          </div>
          {settings.offlineMode && (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-600 text-white rounded-full shadow-sm animate-in zoom-in duration-300">
               <Database className="w-3 h-3" />
               <span className="text-[10px] font-bold uppercase tracking-widest">Local Engine Active</span>
            </div>
          )}
        </div>
        
        {!isOnline && !settings.offlineMode && (
          <div className="flex items-center gap-2 px-3 py-1 bg-amber-50 text-amber-700 rounded-full border border-amber-100 animate-in fade-in slide-in-from-top-1 duration-300">
             <WifiOff className="w-3 h-3" />
             <span className="text-[10px] font-bold uppercase">No connection. Enable Offline Mode in settings.</span>
          </div>
        )}
      </div>

      {/* Controls Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6 p-2 bg-white rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.06)] border border-gray-100">
        
        {/* Source Language Select */}
        <div className="w-full md:w-[35%]">
          <select 
            value={sourceLang}
            onChange={(e) => setSourceLang(e.target.value)}
            className="w-full p-4 text-base font-bold text-gray-700 bg-transparent border-none appearance-none focus:ring-0 cursor-pointer outline-none transition-colors hover:text-blue-600"
          >
            <option value="Auto-Detect">Auto-Detect</option>
            {LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.name}>{lang.name}</option>
            ))}
          </select>
        </div>

        {/* Action Group */}
        <div className="flex items-center gap-2">
            {/* Swap Button */}
            <button 
              onClick={handleSwapLanguages}
              className="p-3 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-all group shrink-0 shadow-sm border border-gray-100 md:border-none"
              title="Swap languages"
            >
              <ArrowRightLeft className="w-5 h-5 transition-transform group-hover:rotate-180 duration-300" />
            </button>

            {/* Translation Settings */}
            <div className="relative" ref={settingsRef}>
                <button 
                  onClick={() => setShowSettings(!showSettings)}
                  className={`p-3 rounded-full transition-all flex items-center justify-center border shadow-sm ${showSettings ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white text-gray-400 hover:text-blue-600 hover:bg-blue-50 border-gray-100 md:border-none'}`}
                  title="Translation Preferences"
                >
                  <Settings className={`w-5 h-5 ${showSettings ? 'animate-spin-slow' : ''}`} />
                </button>

                {showSettings && (
                   <div className="absolute top-full mt-2 right-0 md:left-1/2 md:-translate-x-1/2 w-[280px] bg-white rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.15)] border border-gray-100 z-[100] p-5 animate-in fade-in zoom-in-95 duration-200">
                      <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-50">
                        <span className="text-sm font-bold text-gray-900">Preferences</span>
                        <button 
                          onClick={() => setSettings({ tone: 'neutral', format: 'text', mode: 'natural' })}
                          className="text-[10px] font-bold text-gray-400 hover:text-blue-600 flex items-center gap-1 uppercase tracking-wider"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Reset
                        </button>
                      </div>

                      <div className="space-y-5">
                         {/* Offline Mode Toggle */}
                         <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
                            <div className="flex items-center justify-between mb-2">
                               <div className="flex items-center gap-2">
                                  <Database className="w-4 h-4 text-blue-600" />
                                  <span className="text-xs font-bold text-gray-900">Offline Mode</span>
                               </div>
                               <button 
                                 onClick={() => setSettings(prev => ({ ...prev, offlineMode: !prev.offlineMode }))}
                                 className={`w-10 h-5 rounded-full transition-all relative ${settings.offlineMode ? 'bg-blue-600' : 'bg-gray-200'}`}
                               >
                                 <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${settings.offlineMode ? 'left-6' : 'left-1'}`} />
                               </button>
                            </div>
                            <p className="text-[10px] text-gray-500 mb-4 leading-relaxed font-medium">Use local language packs to translate without internet. Limited accuracy compared to cloud-based translation.</p>
                            
                            <div className="space-y-2 max-h-[150px] overflow-y-auto pr-1">
                               {LANGUAGES.slice(0, 8).map((lang) => {
                                 const isDownloaded = downloadedPacks.includes(lang.name);
                                 const downloading = isDownloading === lang.name;
                                 
                                 return (
                                   <div key={lang.code} className="flex items-center justify-between p-2 bg-white rounded-xl border border-gray-100 shadow-sm">
                                      <div className="flex items-center gap-2">
                                        <div className={`w-1.5 h-1.5 rounded-full ${isDownloaded ? 'bg-green-500' : 'bg-gray-300'}`} />
                                        <span className="text-xs font-bold text-gray-700">{lang.name}</span>
                                      </div>
                                      
                                      {downloading ? (
                                        <div className="flex items-center gap-2 w-20">
                                           <div className="flex-grow h-1 bg-gray-100 rounded-full overflow-hidden">
                                              <div className="h-full bg-blue-600 transition-all" style={{ width: `${downloadProgress}%` }} />
                                           </div>
                                           <span className="text-[9px] font-bold text-blue-600">{downloadProgress}%</span>
                                        </div>
                                      ) : isDownloaded ? (
                                        <button onClick={() => removePack(lang.name)} className="p-1 px-2 text-[10px] font-bold text-red-500 hover:bg-red-50 rounded-lg transition-colors">Uninstall</button>
                                      ) : (
                                        <button 
                                          onClick={() => downloadPack(lang.name)} 
                                          className="flex items-center gap-1.5 p-1 px-2 text-[10px] font-bold text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                        >
                                          <DownloadCloud className="w-3 h-3" />
                                          Download
                                        </button>
                                      )}
                                   </div>
                                 );
                               })}
                            </div>
                         </div>

                         {/* Accuracy vs Naturalness */}
                         <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 block">Translation Strategy</label>
                            <div className="flex gap-2">
                               {(['literal', 'natural'] as const).map((m) => (
                                 <button 
                                   key={m}
                                   onClick={() => setSettings(prev => ({ ...prev, mode: m }))}
                                   className={`flex-1 px-3 py-2 rounded-xl text-xs font-bold capitalize transition-all border ${settings.mode === m ? 'bg-blue-50 border-blue-200 text-blue-600 shadow-sm' : 'bg-white border-gray-100 text-gray-500 hover:bg-gray-50'}`}
                                 >
                                   <div className="flex items-center justify-center gap-2">
                                      {m}
                                      {settings.mode === m && <Check className="w-3 h-3" />}
                                   </div>
                                 </button>
                               ))}
                            </div>
                         </div>
                         
                         {/* Tone Setting */}
                         <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 block">Tone & Style</label>
                            <div className="grid grid-cols-2 gap-2">
                               {(['neutral', 'formal', 'informal', 'professional', 'creative'] as const).map((t) => (
                                 <button 
                                   key={t}
                                   onClick={() => setSettings(prev => ({ ...prev, tone: t }))}
                                   className={`px-3 py-2 rounded-xl text-xs font-bold capitalize transition-all border ${settings.tone === t ? 'bg-blue-50 border-blue-200 text-blue-600 shadow-sm' : 'bg-white border-gray-100 text-gray-500 hover:bg-gray-50'}`}
                                 >
                                   <div className="flex items-center justify-between gap-1">
                                      {t}
                                      {settings.tone === t && <Check className="w-3 h-3" />}
                                   </div>
                                 </button>
                               ))}
                            </div>
                         </div>

                         {/* Format Setting */}
                         <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 block">Output Format</label>
                            <div className="flex flex-col gap-2">
                               {(['text', 'markdown', 'bullet_points'] as const).map((f) => (
                                 <button 
                                   key={f}
                                   onClick={() => setSettings(prev => ({ ...prev, format: f }))}
                                   className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all border flex items-center justify-between ${settings.format === f ? 'bg-blue-50 border-blue-200 text-blue-600 shadow-sm' : 'bg-white border-gray-100 text-gray-500 hover:bg-gray-50'}`}
                                 >
                                   <span className="capitalize">{f.replace('_', ' ')}</span>
                                   {settings.format === f && <Check className="w-4 h-4" />}
                                 </button>
                               ))}
                            </div>
                         </div>
                         {/* OCR & Image Settings */}
                         <div className="pt-2 border-t border-gray-50">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4 block">Image & OCR Intelligence</label>
                            
                            <div className="space-y-4">
                               <div className="flex items-center justify-between">
                                  <div className="flex flex-col">
                                     <span className="text-xs font-bold text-gray-700">Pre-process Image</span>
                                     <span className="text-[9px] text-gray-400">Enhance contrast for low-res files</span>
                                  </div>
                                  <button 
                                    onClick={() => setSettings(prev => ({ ...prev, enhanceImage: !prev.enhanceImage }))}
                                    className={`w-9 h-5 rounded-full transition-all relative ${settings.enhanceImage ? 'bg-blue-600' : 'bg-gray-200'}`}
                                  >
                                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${settings.enhanceImage ? 'left-5' : 'left-1'}`} />
                                  </button>
                               </div>

                               {settings.enhanceImage && (
                                 <div className="pl-4 space-y-4 border-l-2 border-blue-50 mt-2">
                                    <div className="flex items-center justify-between">
                                       <div className="flex flex-col">
                                          <span className="text-xs font-bold text-gray-700">Sharpen Text</span>
                                          <span className="text-[9px] text-gray-400">Reduce edge blur</span>
                                       </div>
                                       <button 
                                         onClick={() => setSettings(prev => ({ ...prev, ocrSharpen: !prev.ocrSharpen }))}
                                         className={`w-9 h-5 rounded-full transition-all relative ${settings.ocrSharpen ? 'bg-blue-600' : 'bg-gray-200'}`}
                                       >
                                         <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${settings.ocrSharpen ? 'left-5' : 'left-1'}`} />
                                       </button>
                                    </div>

                                    <div>
                                       <div className="flex justify-between items-center mb-2">
                                          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Contrast</span>
                                          <span className="text-[10px] font-bold text-blue-600">{settings.ocrContrast}%</span>
                                       </div>
                                       <input 
                                         type="range"
                                         min="0"
                                         max="100"
                                         value={settings.ocrContrast ?? 50}
                                         onChange={(e) => setSettings(prev => ({ ...prev, ocrContrast: parseInt(e.target.value) }))}
                                         className="w-full h-1 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                       />
                                    </div>
                                 </div>
                               )}

                               <div className="flex items-center justify-between">
                                  <div className="flex flex-col">
                                     <span className="text-xs font-bold text-gray-700">High Precision OCR</span>
                                     <span className="text-[9px] text-gray-400">Handle skewed text & complex layouts</span>
                                  </div>
                                  <button 
                                    onClick={() => setSettings(prev => ({ ...prev, highPrecisionOCR: !prev.highPrecisionOCR }))}
                                    className={`w-9 h-5 rounded-full transition-all relative ${settings.highPrecisionOCR ? 'bg-blue-600' : 'bg-gray-200'}`}
                                  >
                                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${settings.highPrecisionOCR ? 'left-5' : 'left-1'}`} />
                                  </button>
                               </div>
                            </div>
                         </div>

                         <div className="pt-2 border-t border-gray-50">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4 block">Voice Intelligence</label>
                            
                            <div className="space-y-4">
                               <div className="flex items-center justify-between">
                                  <div className="flex flex-col">
                                     <span className="text-xs font-bold text-gray-700">Continuous Dictation</span>
                                     <span className="text-[9px] text-gray-400">Keep listening after pauses</span>
                                  </div>
                                  <button 
                                    onClick={() => setSettings(prev => ({ 
                                      ...prev, 
                                      voiceConfig: { ...prev.voiceConfig!, continuous: !prev.voiceConfig?.continuous } 
                                    }))}
                                    className={`w-9 h-5 rounded-full transition-all relative ${settings.voiceConfig?.continuous ? 'bg-blue-600' : 'bg-gray-200'}`}
                                  >
                                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${settings.voiceConfig?.continuous ? 'left-5' : 'left-1'}`} />
                                  </button>
                               </div>

                               <div>
                                  <div className="flex justify-between items-center mb-2">
                                     <span className="text-xs font-bold text-gray-700">Acoustic Sensitivity</span>
                                     <span className="text-[10px] font-bold text-blue-600">{settings.voiceConfig?.sensitivity}%</span>
                                  </div>
                                  <input 
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={settings.voiceConfig?.sensitivity ?? 80}
                                    onChange={(e) => setSettings(prev => ({ 
                                      ...prev, 
                                      voiceConfig: { ...prev.voiceConfig!, sensitivity: parseInt(e.target.value) } 
                                    }))}
                                    className="w-full h-1.5 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                  />
                               </div>

                               <div className="grid grid-cols-2 gap-2">
                                  {(['standard', 'enhanced'] as const).map((m) => (
                                     <button 
                                       key={m}
                                       onClick={() => setSettings(prev => ({ 
                                          ...prev, 
                                          voiceConfig: { ...prev.voiceConfig!, model: m } 
                                       }))}
                                       className={`px-3 py-2 rounded-xl text-xs font-bold capitalize transition-all border ${settings.voiceConfig?.model === m ? 'bg-blue-50 border-blue-200 text-blue-600 shadow-sm' : 'bg-white border-gray-100 text-gray-500 hover:bg-gray-50'}`}
                                     >
                                       <div className="flex items-center justify-center gap-1.5">
                                          {m}
                                          {settings.voiceConfig?.model === m && <Check className="w-3 h-3" />}
                                       </div>
                                     </button>
                                  ))}
                               </div>

                               <div className="h-px bg-gray-50 my-2" />
                               
                               <div className="grid grid-cols-2 gap-4">
                                  <div>
                                     <div className="flex justify-between items-center mb-2">
                                        <span className="text-[10px] font-bold text-gray-500 uppercase">Rate</span>
                                        <span className="text-[10px] font-bold text-blue-600">{settings.voiceConfig?.rate ?? 1}x</span>
                                     </div>
                                     <input 
                                       type="range"
                                       min="0.5"
                                       max="2"
                                       step="0.1"
                                       value={settings.voiceConfig?.rate ?? 1}
                                       onChange={(e) => setSettings(prev => ({ 
                                         ...prev, 
                                         voiceConfig: { ...prev.voiceConfig!, rate: parseFloat(e.target.value) } 
                                       }))}
                                       className="w-full h-1 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                     />
                                  </div>
                                  <div>
                                     <div className="flex justify-between items-center mb-2">
                                        <span className="text-[10px] font-bold text-gray-500 uppercase">Pitch</span>
                                        <span className="text-[10px] font-bold text-blue-600">{settings.voiceConfig?.pitch ?? 1}x</span>
                                     </div>
                                     <input 
                                       type="range"
                                       min="0.5"
                                       max="2"
                                       step="0.1"
                                       value={settings.voiceConfig?.pitch ?? 1}
                                       onChange={(e) => setSettings(prev => ({ 
                                         ...prev, 
                                         voiceConfig: { ...prev.voiceConfig!, pitch: parseFloat(e.target.value) } 
                                       }))}
                                       className="w-full h-1 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                     />
                                  </div>
                               </div>
                            </div>
                         </div>
                      </div>

                      <div className="mt-6 pt-4 border-t border-gray-50">
                         <button 
                          onClick={() => setShowSettings(false)}
                          className="w-full py-3 bg-gray-900 text-white rounded-xl text-sm font-bold shadow-lg hover:bg-black transition-all active:scale-[0.98]"
                         >
                           Done
                         </button>
                      </div>
                   </div>
                )}
            </div>
        </div>

        {/* Target Language Select */}
        <div className="w-full md:w-[35%]">
          <select 
            value={targetLang}
            onChange={(e) => setTargetLang(e.target.value)}
            className="w-full p-4 text-base font-bold text-gray-700 bg-transparent border-none appearance-none focus:ring-0 cursor-pointer outline-none transition-colors hover:text-blue-600 md:text-right"
          >
            {LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.name}>{lang.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Translation Areas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Source Area */}
        <div 
          className={`relative flex flex-col bg-white rounded-3xl border shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden transition-all focus-within:border-blue-300 focus-within:shadow-[0_8px_30px_rgb(59,130,246,0.08)] ${isDragging ? 'border-blue-500 bg-blue-50/20' : 'border-gray-200'}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {isDragging && (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-blue-600/90 text-white animate-in fade-in zoom-in-95 duration-200 backdrop-blur-sm">
              <Upload className="w-12 h-12 mb-4 animate-bounce" />
              <p className="text-xl font-bold">Drop to Translate</p>
              <p className="text-sm opacity-80 mt-1">PDF or Images supported</p>
            </div>
          )}
          <div className="relative flex flex-col flex-grow">
            {filePreview && (
              <div className={`mx-6 mt-6 relative rounded-2xl overflow-hidden border border-gray-100 shadow-sm transition-all group/preview ${fileData?.mimeType === 'application/pdf' ? 'h-[400px]' : 'max-h-[200px]'}`}>
                {fileData?.mimeType === 'application/pdf' ? (
                  <iframe 
                    src={filePreview} 
                    className="w-full h-full border-none bg-gray-50"
                    title="PDF Preview"
                  />
                ) : (
                  <img src={filePreview} alt="Preview" className="w-full h-full object-contain bg-gray-50" />
                )}
                
                <div className="absolute inset-0 bg-black/0 group-hover/preview:bg-black/5 transition-colors pointer-events-none" />
                
                {showClearConfirm ? (
                   <div className="absolute inset-0 bg-red-600/95 flex flex-col items-center justify-center text-white p-4 animate-in fade-in duration-200">
                      <p className="font-bold mb-3 text-sm">Remove this {fileData?.mimeType === 'application/pdf' ? 'document' : 'image'}?</p>
                      <div className="flex gap-4">
                        <button onClick={clearFile} className="bg-white text-red-600 px-4 py-2 rounded-xl font-bold text-xs hover:bg-red-50 shadow-sm transition-all active:scale-95">Yes, Remove</button>
                        <button onClick={() => setShowClearConfirm(false)} className="text-white font-bold text-xs hover:underline transition-all">Cancel</button>
                      </div>
                   </div>
                ) : (
                  <button 
                    onClick={handleClearRequest}
                    className="absolute top-2 right-2 p-1.5 bg-black/50 text-white rounded-full hover:bg-black/70 backdrop-blur-sm transition-opacity opacity-0 group-hover/preview:opacity-100"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
            <textarea
              value={sourceText}
              onChange={(e) => setSourceText(e.target.value)}
              placeholder={fileData ? "Add context or instructions for this file (optional)..." : "Type, paste text, or drag a file here..."}
              className={`w-full min-h-[300px] p-6 text-xl md:text-2xl text-gray-800 placeholder-gray-400 bg-transparent border-none resize-none focus:ring-0 outline-none ${filePreview ? 'pt-4' : ''}`}
              spellCheck="false"
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between p-4 bg-gray-50/50 border-t border-gray-100">
            <div className="flex items-center gap-3">
              <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="image/*,application/pdf,text/plain,.xlsx,.xls"
                  multiple
                  onChange={handleFileChange}
              />
              <button 
                 disabled={isProcessingQueue}
                 onClick={() => fileInputRef.current?.click()}
                 className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm border ${fileData ? 'bg-blue-600 text-white border-blue-600 shadow-blue-100' : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-200 active:scale-95'} ${isProcessingQueue ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                 <Paperclip className="w-4 h-4" />
                 {fileData ? 'File Attached' : 'Attach Library'}
              </button>
              
              {processedFiles.length > 0 && !isBatchTranslating && batchResults.length === 0 && (
                <button 
                  onClick={handleBatchTranslate}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-green-600 text-white shadow-sm border border-green-600 hover:bg-green-700 transition-all active:scale-95"
                >
                  <Sparkles className="w-4 h-4" />
                  Translate Batch ({processedFiles.length})
                </button>
              )}

              {isBatchTranslating && (
                <div className="flex items-center gap-3 px-4 py-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 shadow-sm animate-pulse">
                  <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs font-bold uppercase tracking-wider">Processing Batch...</span>
                </div>
              )}

              {uploadProgress !== null && currentFileIndex !== null && (
                 <div className="flex flex-col gap-1 w-48 animate-in fade-in duration-300">
                   <div className="flex justify-between text-[10px] text-blue-600 font-bold uppercase tracking-wider">
                     <span className="truncate max-w-[100px]">Reading {fileQueue[currentFileIndex]?.name}</span>
                     <span>{uploadProgress}%</span>
                   </div>
                   <div className="h-1.5 w-full bg-blue-100 rounded-full overflow-hidden flex items-center">
                     <div 
                       className="h-full bg-blue-600 transition-all duration-300 ease-out" 
                       style={{ width: `${uploadProgress}%` }}
                     />
                   </div>
                   <div className="flex justify-between items-center mt-1">
                      <span className="text-[9px] text-gray-400 font-bold">Queue: {currentFileIndex + 1}/{fileQueue.length}</span>
                      <button 
                        onClick={cancelUpload}
                        className="text-[9px] text-red-500 font-bold hover:underline"
                      >
                        Cancel
                      </button>
                   </div>
                 </div>
              )}
              {fileData && !filePreview && !uploadProgress && (
                 <div className="relative flex items-center gap-2 px-3.5 py-2.5 bg-blue-50 text-blue-700 text-sm rounded-xl border border-blue-100 transition-all overflow-hidden shadow-sm">
                     {fileData.mimeType.includes('pdf') || fileData.mimeType.includes('text') ? <FileText className="w-4 h-4 shrink-0" /> : 
                      fileData.mimeType.includes('sheet') || fileData.mimeType.includes('excel') ? <FileSpreadsheet className="w-4 h-4 shrink-0" /> :
                      <ImageIcon className="w-4 h-4 shrink-0" />}
                     <span className="max-w-[120px] sm:max-w-[200px] truncate font-bold text-xs">{fileData.name}</span>
                     
                     {showClearConfirm ? (
                       <div className="absolute inset-0 bg-blue-600 flex items-center justify-center gap-3 px-3 animate-in slide-in-from-right-full duration-200">
                         <span className="text-[10px] text-white font-bold uppercase tracking-widest">Remove?</span>
                         <div className="flex gap-2">
                           <button onClick={clearFile} className="bg-white text-blue-600 text-[10px] px-2.5 py-1 rounded-lg font-bold hover:bg-blue-50 transition-colors shadow-sm">Yes</button>
                           <button onClick={() => setShowClearConfirm(false)} className="text-white text-[10px] font-bold hover:underline">No</button>
                         </div>
                       </div>
                     ) : (
                       <button onClick={handleClearRequest} className="hover:bg-blue-200 p-1 rounded-full ml-1 shrink-0 transition-colors" title="Remove file">
                        <X className="w-3.5 h-3.5" />
                       </button>
                     )}
                 </div>
              )}
              <button 
                onClick={toggleListening}
                className={`p-2 rounded-xl transition-all ${isListening ? 'bg-red-100 text-red-600 animate-pulse' : 'text-gray-600 hover:bg-gray-100'}`}
                title={isListening ? 'Stop listening' : 'Translate with voice'}
              >
                {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>
            </div>
            
            <div className="flex gap-2 items-center w-full sm:w-auto justify-end mt-2 sm:mt-0">
               {detectedLang && sourceLang === 'Auto-Detect' && (
                 <span className="flex items-center gap-1.5 px-2 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded-lg border border-blue-100 animate-in fade-in slide-in-from-bottom-1">
                   <Search className="w-3 h-3" />
                   Detected: {detectedLang}
                 </span>
               )}
               <span className="text-sm text-gray-400 font-medium mr-2">
                  {sourceText.length} characters
               </span>
               <button 
                   onClick={() => setSourceText('')}
                   className={`p-2 rounded-xl text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors ${sourceText ? 'opacity-100' : 'opacity-0'}`}
                   title="Clear text"
               >
                   <X className="w-5 h-5" />
               </button>
            </div>
          </div>
        </div>

        {/* Target Area */}
        <div className="relative flex flex-col bg-gray-50 rounded-3xl border border-gray-200 overflow-hidden">
          {error && (
            <div className="absolute top-4 left-4 right-4 bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-100 z-10">
              {error}
            </div>
          )}
          
          <div className="relative flex-grow h-full">
            {batchResults.length > 0 ? (
              <div className="absolute inset-0 z-20 bg-white p-6 overflow-y-auto">
                <div className="flex items-center justify-between mb-8 pb-4 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <FileOutput className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-extrabold text-gray-900">Batch Results</h3>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{batchResults.length} Files Translated</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={handleDownloadConsolidatedPDF}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                      title="Download All as PDF"
                    >
                      <Download className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={handleDownloadConsolidatedExcel}
                      className="p-2 text-gray-400 hover:text-green-500 hover:bg-green-50 rounded-xl transition-all"
                      title="Download All as Excel"
                    >
                      <FileSpreadsheet className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={handleDownloadConsolidatedCSV}
                      className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-xl transition-all"
                      title="Download All as CSV"
                    >
                      <Table className="w-5 h-5" />
                    </button>
                    <div className="w-px h-6 bg-gray-100 mx-1" />
                    <button 
                      onClick={clearBatch}
                      className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-all"
                      title="Close and Clear Batch"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div className="space-y-6">
                  {batchResults.map((result, i) => (
                    <div key={i} className="group p-5 bg-gray-50 rounded-2xl border border-gray-100 transition-all hover:bg-white hover:shadow-md">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-blue-500" />
                          <span className="text-sm font-bold text-gray-700">{result.name}</span>
                        </div>
                        <button 
                          onClick={() => copyToClipboard(result.translatedText)}
                          className="p-1 px-2 text-[10px] font-bold text-blue-600 hover:bg-blue-100 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          Copy Result
                        </button>
                      </div>
                      <p className="text-gray-600 text-sm leading-relaxed line-clamp-3 italic">
                        {result.translatedText}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : isTranslating ? (
              <div className="absolute inset-0 z-10 bg-gray-50 flex flex-col">
                <div className="p-6 flex flex-col gap-6">
                  <div className="flex items-center gap-3 mb-2 animate-in fade-in duration-500">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Sparkles className="w-5 h-5 text-blue-600 animate-pulse" />
                    </div>
                    <span className="text-sm font-bold text-blue-600 uppercase tracking-widest animate-pulse">
                      {fileData 
                        ? (fileData.mimeType.includes('pdf') ? 'Analyzing PDF Document...' : 'Processing Image Content...') 
                        : 'Translating Content...'}
                    </span>
                  </div>
                  <div className="space-y-4">
                    <div className="h-4 bg-gray-200 rounded-full w-full animate-pulse" style={{ animationDelay: '0ms' }} />
                    <div className="h-4 bg-gray-200 rounded-full w-[90%] animate-pulse" style={{ animationDelay: '100ms' }} />
                    <div className="h-4 bg-gray-200 rounded-full w-[95%] animate-pulse" style={{ animationDelay: '200ms' }} />
                    <div className="h-4 bg-gray-200 rounded-full w-[85%] animate-pulse" style={{ animationDelay: '300ms' }} />
                    <div className="h-4 bg-gray-200 rounded-full w-[40%] animate-pulse" style={{ animationDelay: '400ms' }} />
                  </div>
                </div>
              </div>
            ) : (
              <textarea
                value={translatedText}
                readOnly
                placeholder="Translation will appear here"
                className="w-full h-full min-h-[300px] p-6 text-xl md:text-2xl text-gray-800 placeholder-gray-400 bg-transparent border-none resize-none focus:ring-0 outline-none"
              />
            )}
            {/* Branding Indicator */}
            <div className="absolute bottom-6 left-6 flex items-center gap-2 pointer-events-none opacity-20">
               <Sparkles className="w-4 h-4 text-gray-400" />
               <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">Context Aware Local Engine</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between p-4 border-t border-gray-200/60 gap-3">
            <div className="w-full flex items-center justify-between sm:w-auto sm:justify-start gap-4">
                <span className="text-sm text-gray-400 font-medium">
                  {translatedText.length} characters
                </span>
                <span className="text-xs text-gray-400">Powered by Google Gemini</span>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <button 
                 onClick={toggleSpeech}
                 className={`p-2.5 rounded-xl border shadow-sm transition-all disabled:opacity-50 ${isSpeaking ? 'bg-red-50 text-red-600 border-red-200' : 'bg-white text-gray-500 hover:text-blue-600 border-gray-100 hover:border-blue-200'}`}
                 disabled={!translatedText}
                 title={isSpeaking ? "Stop Speaking" : "Listen to Translation"}
              >
                 {isSpeaking ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>

              <button 
                 onClick={toggleSaveCurrent}
                 className={`p-2.5 rounded-xl border shadow-sm transition-all disabled:opacity-50 ${isCurrentSaved ? 'bg-yellow-50 text-yellow-600 border-yellow-200 shadow-yellow-100/50' : 'bg-white text-gray-500 hover:text-yellow-600 hover:bg-yellow-50 hover:border-yellow-200'}`}
                 disabled={!translatedText}
                 title={isCurrentSaved ? 'Remove from saved' : 'Save to bookmarks'}
              >
                 <Star className={`w-5 h-5 ${isCurrentSaved ? 'fill-current' : ''}`} />
              </button>
              
              <div className="relative flex-1 sm:flex-none" ref={exportRef}>
                <button 
                  onClick={() => setShowExportOptions(!showExportOptions)}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-gray-600 bg-white hover:text-blue-600 border border-gray-200 hover:border-blue-200 shadow-sm hover:shadow transition-all font-medium disabled:opacity-50"
                  disabled={!translatedText}
                  title="Export Options"
                >
                  <FileOutput className="w-4 h-4" />
                  <span className="inline">Export</span>
                </button>

                {showExportOptions && (
                  <div className="absolute bottom-full right-0 mb-2 w-56 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 p-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
                    {matchedFormat && (
                      <>
                        <div className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Recommended (Matches Input)</div>
                        <button 
                          onClick={() => { handleDownloadSmart(); setShowExportOptions(false); }}
                          className="w-full flex items-center gap-3 px-3 py-3 bg-blue-50 hover:bg-blue-100 rounded-xl text-sm font-bold text-blue-700 transition-colors mb-2"
                        >
                          {matchedFormat.icon}
                          <div className="flex flex-col items-start leading-tight">
                            <span>{matchedFormat.name}</span>
                            <span className="text-[9px] opacity-70">Matching source format</span>
                          </div>
                        </button>
                        <div className="h-px bg-gray-50 mx-2 mb-2" />
                      </>
                    )}
                    
                    <div className="px-3 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{matchedFormat ? 'Other Formats' : 'Export as'}</div>
                    <button 
                      onClick={() => { handleDownloadDoc(); setShowExportOptions(false); }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 rounded-xl text-sm font-bold text-gray-700 transition-colors"
                    >
                      <FileText className="w-4 h-4 text-blue-500" />
                      Word Document
                    </button>
                    <button 
                      onClick={() => { handleDownloadPDF(); setShowExportOptions(false); }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 rounded-xl text-sm font-bold text-gray-700 transition-colors"
                    >
                      <FileOutput className="w-4 h-4 text-red-500" />
                      PDF Document
                    </button>
                    <button 
                      onClick={() => { handleDownloadExcel(); setShowExportOptions(false); }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 rounded-xl text-sm font-bold text-gray-700 transition-colors"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-green-500" />
                      Excel Sheet
                    </button>
                    <button 
                      onClick={() => { handleDownloadCSV(); setShowExportOptions(false); }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 rounded-xl text-sm font-bold text-gray-700 transition-colors"
                    >
                      <Table className="w-4 h-4 text-blue-400" />
                      CSV Document
                    </button>
                  </div>
                )}
              </div>

              <button 
                 onClick={() => copyToClipboard(translatedText)}
                 className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-white bg-blue-600 hover:bg-blue-700 shadow flex-1 sm:flex-none transition-all font-medium disabled:opacity-50"
                 disabled={!translatedText}
              >
                 <Copy className="w-4 h-4" />
                 Copy
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* History & Saved Section */}
      {(history.length > 0 || savedTranslations.length > 0) && (
        <div className="mt-12">
          <div className="flex flex-col sm:flex-row items-center justify-between mb-8 pb-4 border-b border-gray-100 gap-4">
            <div className="flex items-center gap-1 bg-gray-100/80 p-1 rounded-xl">
              <button 
                onClick={() => setActiveTab('history')}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'history' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <History className="w-4 h-4" />
                Recent History
              </button>
              <button 
                onClick={() => setActiveTab('saved')}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'saved' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <Star className="w-4 h-4" />
                Saved Translations
              </button>
            </div>
            
            <button 
              onClick={activeTab === 'history' ? clearHistory : () => setSavedTranslations([])}
              className="text-xs text-gray-400 hover:text-red-600 font-bold uppercase tracking-wider transition-colors"
            >
              Clear all {activeTab}
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {(activeTab === 'history' ? history : savedTranslations).map((item) => (
              <div 
                key={item.id}
                className="group relative bg-white p-6 rounded-3xl border border-gray-100 hover:border-blue-200 shadow-[0_2px_15px_rgb(0,0,0,0.02)] hover:shadow-[0_8px_30px_rgb(59,130,246,0.06)] transition-all cursor-pointer"
                onClick={() => restoreHistory(item)}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 px-2 py-1 bg-gray-50 rounded-lg text-[10px] font-bold uppercase tracking-wider text-gray-500 border border-gray-100">
                    <span>{item.sourceLang}</span>
                    <ArrowRightLeft className="w-3 h-3 text-blue-400" />
                    <span>{item.targetLang}</span>
                  </div>
                  <div className="flex gap-1">
                    {activeTab === 'history' && (
                       <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          const isSaved = savedTranslations.some(s => s.sourceText === item.sourceText && s.targetLang === item.targetLang);
                          if (!isSaved) {
                            setSavedTranslations(prev => [item, ...prev]);
                            setActiveTab('saved');
                          }
                        }}
                        className={`p-1.5 rounded-lg transition-all ${savedTranslations.some(s => s.sourceText === item.sourceText && s.targetLang === item.targetLang) ? 'text-yellow-500' : 'text-gray-300 hover:text-yellow-500 hover:bg-yellow-50'}`}
                      >
                        <Star className={`w-4 h-4 ${savedTranslations.some(s => s.sourceText === item.sourceText && s.targetLang === item.targetLang) ? 'fill-current' : ''}`} />
                      </button>
                    )}
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        activeTab === 'history' ? deleteHistoryItem(item.id) : setSavedTranslations(prev => prev.filter(s => s.id !== item.id));
                      }}
                      className="p-1.5 opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all rounded-lg hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <p className="text-sm text-gray-900 font-bold line-clamp-2 mb-3 leading-relaxed">{item.sourceText}</p>
                <p className="text-xs text-gray-500 line-clamp-3 italic leading-relaxed">{item.translatedText}</p>
                <div className="mt-4 flex items-center justify-between text-[10px] text-gray-300 font-bold uppercase tracking-widest">
                  <span>{new Date(item.timestamp).toLocaleDateString()}</span>
                  <span className="opacity-0 group-hover:opacity-100 text-blue-500 transition-opacity">Restore →</span>
                </div>
              </div>
            ))}
            
            {(activeTab === 'history' ? history : savedTranslations).length === 0 && (
              <div className="col-span-full py-20 text-center bg-gray-50/50 rounded-[2rem] border border-dashed border-gray-200">
                 <div className="bg-white w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                    {activeTab === 'history' ? <History className="w-6 h-6 text-gray-300" /> : <Star className="w-6 h-6 text-gray-300" />}
                 </div>
                 <p className="text-gray-400 font-medium tracking-tight">No {activeTab} yet. Start translating to see content here.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
