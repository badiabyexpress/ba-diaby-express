/**
 * 🔔 Composant de statut de synchronisation
 * Affiche les écritures en attente et permet de les gérer
 */

import React, { useState, useEffect } from "react";
import { pendingSyncCount, detailFileAttente, flushOutbox, abandonnerEcriture } from "../lib/storage.js";

export default function SyncQueueStatus() {
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [count, setCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);

  // Mettre à jour l'état de la file
  const updateQueue = () => {
    const newCount = pendingSyncCount();
    setCount(newCount);
    if (newCount > 0) {
      setItems(detailFileAttente());
    }
  };

  useEffect(() => {
    updateQueue();
    // Vérifier chaque 5 secondes
    const interval = setInterval(updateQueue, 5000);
    // Écouter les changements de la file
    window.addEventListener("storage", updateQueue);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener("storage", updateQueue);
    };
  }, []);

  const handleForceSync = async () => {
    setSyncing(true);
    setError(null);
    try {
      const result = await flushOutbox({ forcer: true });
      console.log("Synchronisation forcée:", result);
      updateQueue();
    } catch (e) {
      setError(e.message || "Erreur lors de la synchronisation");
      console.error("Erreur sync:", e);
    } finally {
      setSyncing(false);
    }
  };

  const handleAbandon = (index) => {
    if (window.confirm(`⚠️ Confirmer la suppression de cette écriture? Cette action est irréversible.`)) {
      const item = items[index];
      abandonnerEcriture(item.cle);
      updateQueue();
    }
  };

  if (count === 0) {
    return null; // Rien à afficher
  }

  const formatDuration = (ts) => {
    if (!ts) return "?";
    const seconds = Math.round((Date.now() - ts) / 1000);
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    return `${Math.round(seconds / 3600)}h`;
  };

  return (
    <div className="sync-queue-container">
      {/* Badge flottant */}
      <button
        className="sync-queue-badge"
        onClick={() => setIsOpen(!isOpen)}
        title={`${count} écriture(s) en attente de synchronisation`}
      >
        ⏳ {count}
      </button>

      {/* Panel détaillé */}
      {isOpen && (
        <div className="sync-queue-panel">
          <div className="sync-queue-header">
            <h3>📊 Écritures en attente ({count})</h3>
            <button
              className="close-btn"
              onClick={() => setIsOpen(false)}
              title="Fermer"
            >
              ✕
            </button>
          </div>

          {error && (
            <div className="error-message">
              <strong>⚠️ Erreur:</strong> {error}
            </div>
          )}

          <div className="sync-queue-list">
            {items.map((item, idx) => (
              <div key={idx} className={`sync-item ${item.erreur ? "error" : "pending"}`}>
                <div className="sync-item-header">
                  <span className="sync-item-key">{item.cle}</span>
                  <span className="sync-item-time">
                    {item.essais > 0 && `${item.essais} essai(s) • `}
                    {formatDuration(item.depuis)} en attente
                  </span>
                </div>

                {item.erreur && (
                  <div className="sync-item-error">
                    <strong>Erreur:</strong> {item.erreur}
                  </div>
                )}

                {item.contenu.length > 0 && (
                  <div className="sync-item-content">
                    <small>
                      {item.contenu
                        .map((c) => `${c.cle} (${c.nombre})`)
                        .join(", ")}
                    </small>
                  </div>
                )}

                <button
                  className="abandon-btn"
                  onClick={() => handleAbandon(idx)}
                  title="Supprimer cette écriture de la file"
                >
                  Abandonner
                </button>
              </div>
            ))}
          </div>

          <div className="sync-queue-actions">
            <button
              className="force-sync-btn"
              onClick={handleForceSync}
              disabled={syncing}
            >
              {syncing ? "⏳ Synchronisation..." : "🔄 Forcer la synchronisation"}
            </button>
          </div>

          <div className="sync-queue-help">
            <small>
              💡 Si le problème persiste après 5 minutes, vérifiez votre connexion réseau
              ou contactez le support.
            </small>
          </div>
        </div>
      )}

      <style>{`
        .sync-queue-container {
          position: fixed;
          bottom: 20px;
          right: 20px;
          z-index: 1000;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }

        .sync-queue-badge {
          background: linear-gradient(135deg, #ff6b00, #ff8c00);
          color: white;
          border: none;
          border-radius: 50px;
          width: 50px;
          height: 50px;
          font-size: 16px;
          font-weight: bold;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(255, 107, 0, 0.3);
          transition: all 0.2s ease;
        }

        .sync-queue-badge:hover {
          transform: scale(1.1);
          box-shadow: 0 6px 16px rgba(255, 107, 0, 0.4);
        }

        .sync-queue-panel {
          position: absolute;
          bottom: 70px;
          right: 0;
          width: 400px;
          max-height: 500px;
          background: white;
          border-radius: 8px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
          border: 1px solid #e0e0e0;
          display: flex;
          flex-direction: column;
          animation: slideIn 0.2s ease;
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .sync-queue-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px;
          border-bottom: 1px solid #e0e0e0;
          background: #f9f9f9;
        }

        .sync-queue-header h3 {
          margin: 0;
          font-size: 14px;
          font-weight: 600;
          color: #333;
        }

        .close-btn {
          background: none;
          border: none;
          font-size: 16px;
          cursor: pointer;
          color: #999;
          padding: 0;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .close-btn:hover {
          color: #333;
        }

        .error-message {
          padding: 12px 16px;
          background: #fff3cd;
          border-left: 4px solid #ff6b00;
          font-size: 12px;
          color: #856404;
        }

        .sync-queue-list {
          flex: 1;
          overflow-y: auto;
          padding: 8px;
        }

        .sync-item {
          padding: 12px;
          margin-bottom: 8px;
          background: #f5f5f5;
          border-radius: 6px;
          border-left: 4px solid #4CAF50;
          font-size: 12px;
        }

        .sync-item.error {
          border-left-color: #ff6b00;
          background: #fff5f0;
        }

        .sync-item-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
        }

        .sync-item-key {
          font-weight: 600;
          color: #333;
          word-break: break-all;
        }

        .sync-item-time {
          color: #999;
          white-space: nowrap;
          margin-left: 8px;
        }

        .sync-item-error {
          color: #d32f2f;
          margin-bottom: 8px;
          padding: 8px;
          background: #ffebee;
          border-radius: 4px;
        }

        .sync-item-content {
          color: #666;
          margin-bottom: 8px;
          padding: 4px 0;
        }

        .abandon-btn {
          background: #ff6b00;
          color: white;
          border: none;
          padding: 6px 12px;
          border-radius: 4px;
          font-size: 11px;
          cursor: pointer;
          transition: background 0.2s;
        }

        .abandon-btn:hover {
          background: #e55a00;
        }

        .sync-queue-actions {
          padding: 12px 16px;
          border-top: 1px solid #e0e0e0;
          background: #f9f9f9;
        }

        .force-sync-btn {
          width: 100%;
          padding: 10px;
          background: linear-gradient(135deg, #4CAF50, #45a049);
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-weight: 600;
          font-size: 13px;
          transition: all 0.2s;
        }

        .force-sync-btn:hover:not(:disabled) {
          background: linear-gradient(135deg, #45a049, #3d8b40);
          transform: translateY(-1px);
        }

        .force-sync-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .sync-queue-help {
          padding: 12px 16px;
          background: #e3f2fd;
          border-top: 1px solid #bbdefb;
          color: #1565c0;
          text-align: center;
        }

        @media (max-width: 600px) {
          .sync-queue-panel {
            width: calc(100vw - 40px);
            max-height: calc(100vh - 100px);
          }
        }
      `}</style>
    </div>
  );
}
