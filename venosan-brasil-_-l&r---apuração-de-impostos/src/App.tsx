/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { 
  Wallet, 
  Upload, 
  FolderOpen, 
  BarChart3, 
  ShieldCheck, 
  Zap, 
  FileText, 
  Bell, 
  UserCircle, 
  Download, 
  Info,
  CheckCircle2,
  XCircle,
  Loader2,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type Screen = 'upload' | 'results';
type Filter = 'all' | 'difal_only' | 'st_difal';

const DIFAL_ONLY_STATES = ['GO', 'MG', 'PR', 'SC', 'SP'];
const ST_DIFAL_STATES = ['AL', 'BA', 'ES', 'MA', 'MT', 'PA', 'PB', 'PE', 'RJ', 'RN', 'RS'];

interface ProcessResult {
  processId: string;
  states: string[];
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('upload');
  const [filter, setFilter] = useState<Filter>('all');
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Por favor, selecione um arquivo antes de iniciar.');
      return;
    }

    setIsProcessing(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Falha ao processar o arquivo.');
      }

      const data = await response.json();
      setResult(data);
      setScreen('results');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocorreu um erro inesperado.');
    } finally {
      setIsProcessing(false);
    }
  };

  const clearFile = () => {
    setFile(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-[#f6f8f6] text-slate-900 font-sans selection:bg-primary/20">
      <main className="max-w-7xl mx-auto px-6 py-12 lg:py-16">
        <AnimatePresence mode="wait">
          {screen === 'upload' ? (
            <motion.div 
              key="upload"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-4xl mx-auto space-y-12"
            >
              <div className="space-y-12">
                <div>
                  <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 mb-4">
                    Apuração de Impostos
                  </h1>
                  <p className="text-lg text-slate-600 leading-relaxed">
                    Selecione seu arquivo Excel para calcular <span className="text-[#2f7f33] font-semibold">ICMS ST</span> e <span className="text-[#2f7f33] font-semibold">DIFAL</span> de forma rápida.
                  </p>
                </div>

                {/* Step 1 */}
                <div className="relative pl-14 before:absolute before:left-[19px] before:top-10 before:bottom-[-40px] before:w-0.5 before:bg-primary/20">
                  <div className="absolute left-0 top-0 w-10 h-10 rounded-full bg-[#2f7f33] text-white flex items-center justify-center font-bold shadow-lg z-10">1</div>
                  <h2 className="text-xl font-bold text-slate-800 mb-6">Passo 1: Upload do Arquivo</h2>
                  
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className={cn(
                      "group relative flex flex-col items-center gap-6 rounded-xl border-2 border-dashed p-12 transition-all cursor-pointer",
                      file ? "bg-primary/5 border-primary/40" : "bg-white border-primary/20 hover:border-primary/40"
                    )}
                  >
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleFileChange} 
                      className="hidden" 
                      accept=".xlsx,.xls,.csv"
                    />
                    
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-[#2f7f33] group-hover:scale-110 transition-transform">
                      {file ? <CheckCircle2 className="w-10 h-10" /> : <Upload className="w-10 h-10" />}
                    </div>
                    
                    <div className="text-center">
                      <p className="text-lg font-bold text-slate-900">
                        {file ? file.name : "Arraste seu arquivo Excel aqui"}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        Formatos suportados: .xlsx, .xls ou .csv (Máx 25MB)
                      </p>
                    </div>

                    <button className="flex items-center gap-2 px-6 py-2.5 bg-white border border-primary/20 text-[#2f7f33] rounded-lg font-bold hover:bg-primary hover:text-white transition-all shadow-sm">
                      <FolderOpen className="w-5 h-5" />
                      Selecionar Arquivo
                    </button>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="relative pl-14">
                  <div className="absolute left-0 top-0 w-10 h-10 rounded-full bg-primary/20 text-[#2f7f33] border-2 border-primary flex items-center justify-center font-bold z-10">2</div>
                  <h2 className="text-xl font-bold text-slate-800 mb-6">Passo 2: Iniciar Processamento</h2>
                  
                  <div className="bg-white rounded-xl shadow-sm border border-primary/10 p-8 flex flex-col sm:flex-row items-center gap-6">
                    <button 
                      onClick={handleUpload}
                      disabled={isProcessing}
                      className="flex-1 min-w-[240px] h-14 bg-[#2f7f33] text-white rounded-lg font-bold text-lg flex items-center justify-center gap-3 hover:bg-[#2f7f33]/90 transition-all shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isProcessing ? (
                        <Loader2 className="w-6 h-6 animate-spin" />
                      ) : (
                        <BarChart3 className="w-6 h-6" />
                      )}
                      Iniciar Processamento
                    </button>
                    
                    {file && (
                      <button 
                        onClick={clearFile}
                        className="px-6 py-2 text-red-600 font-bold hover:bg-red-50 rounded-lg transition-colors flex items-center gap-2"
                      >
                        <Trash2 className="w-5 h-5" />
                        Limpar
                      </button>
                    )}
                  </div>

                  {error && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-4 p-4 bg-red-50 border border-red-100 rounded-lg flex items-center gap-3 text-red-700"
                    >
                      <XCircle className="w-5 h-5" />
                      <p className="text-sm font-medium">{error}</p>
                    </motion.div>
                  )}
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="results"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-8"
            >
              <div className="space-y-2 flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                  <h1 className="text-4xl font-black tracking-tight text-slate-900">Download de Apurações por Estado</h1>
                </div>
                {result && (
                  <a 
                    href={`/api/download-all/${result.processId}`}
                    className="flex items-center gap-2 px-6 py-3 bg-[#2f7f33] text-white rounded-lg font-bold hover:bg-[#2f7f33]/90 transition-all shadow-lg shadow-primary/20 whitespace-nowrap"
                  >
                    <Download className="w-5 h-5" />
                    Baixar Tudo (ZIP)
                  </a>
                )}
              </div>

              <div className="flex items-center gap-4 bg-primary/5 border border-primary/10 p-4 rounded-xl">
                <Info className="w-5 h-5 text-primary" />
                <p className="text-sm text-primary font-medium">Os arquivos referem-se ao último período de apuração fechado. Selecione o estado desejado abaixo.</p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button 
                  onClick={() => setFilter('all')}
                  className={cn(
                    "px-5 py-2 rounded-full text-sm font-bold transition-all border",
                    filter === 'all' 
                      ? "bg-[#2f7f33] text-white border-[#2f7f33] shadow-md" 
                      : "bg-white text-slate-600 border-slate-200 hover:border-[#2f7f33]/40"
                  )}
                >
                  Todos os Estados
                </button>
                <button 
                  onClick={() => setFilter('difal_only')}
                  className={cn(
                    "px-5 py-2 rounded-full text-sm font-bold transition-all border",
                    filter === 'difal_only' 
                      ? "bg-[#2f7f33] text-white border-[#2f7f33] shadow-md" 
                      : "bg-white text-slate-600 border-slate-200 hover:border-[#2f7f33]/40"
                  )}
                >
                  Apenas DIFAL
                </button>
                <button 
                  onClick={() => setFilter('st_difal')}
                  className={cn(
                    "px-5 py-2 rounded-full text-sm font-bold transition-all border",
                    filter === 'st_difal' 
                      ? "bg-[#2f7f33] text-white border-[#2f7f33] shadow-md" 
                      : "bg-white text-slate-600 border-slate-200 hover:border-[#2f7f33]/40"
                  )}
                >
                  ST e DIFAL
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {result?.states
                  .filter(state => {
                    if (filter === 'difal_only') return DIFAL_ONLY_STATES.includes(state);
                    if (filter === 'st_difal') return ST_DIFAL_STATES.includes(state);
                    return true;
                  })
                  .map((state) => (
                  <div key={state} className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col gap-4 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <h3 className="font-bold text-lg text-slate-800">{state}</h3>
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{state}</span>
                    </div>
                    <div className="flex gap-2 mt-2">
                      {!DIFAL_ONLY_STATES.includes(state) && (
                        <a 
                          href={`/api/download/${result.processId}/${state}/st`}
                          className="flex-1 h-10 bg-[#2f7f33] hover:bg-[#2f7f33]/90 text-white rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all"
                        >
                          <Download className="w-4 h-4" /> ST
                        </a>
                      )}
                      <a 
                        href={`/api/download/${result.processId}/${state}/difal`}
                        className={cn(
                          "h-10 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all",
                          DIFAL_ONLY_STATES.includes(state) ? "flex-1" : "flex-1"
                        )}
                      >
                        <Download className="w-4 h-4" /> DIFAL
                      </a>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-center pt-8">
                <button 
                  onClick={() => setScreen('upload')}
                  className="px-8 py-3 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition-colors"
                >
                  Processar Novo Arquivo
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="mt-auto py-8 border-t border-primary/10 bg-white/50">
        <div className="max-w-7xl mx-auto px-6 lg:px-40 flex flex-col items-center gap-6 text-center">
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-center gap-2 text-[#2f7f33] font-bold">
              Venosan Brasil | L&R
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
