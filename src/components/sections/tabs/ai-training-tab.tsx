"use client";

import { useState, useEffect } from "react";
import { Brain, Play, Download, Upload, TrendingUp, Activity, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface TrainingModel {
  id: number;
  name: string;
  provider: string;
  version: string;
  strategy: string;
  symbol: string;
  timeframe: string;
  status: string;
  accuracy: number;
  trainingData: {
    fromDate: string;
    toDate: string;
    barCount: number;
    parameters: {
      learningRate: number;
      epochs: number;
      batchSize: number;
      validationSplit: number;
    };
    metrics?: {
      accuracy: number;
      precision: number;
      recall: number;
      f1Score: number;
      loss: number;
      valLoss: number;
    };
    completedAt?: string;
  } | null;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

export function AITrainingTab() {
  const [models, setModels] = useState<TrainingModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [training, setTraining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Training form state
  const [modelName, setModelName] = useState("");
  const [strategy, setStrategy] = useState<"scalping" | "swing" | "trend" | "mean_reversion">("scalping");
  const [timeframe, setTimeframe] = useState("M5");
  const [fromDate, setFromDate] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    return date.toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Load models
  const loadModels = async () => {
    try {
      setError(null);
      const res = await fetch("/api/ai/train");
      const data = await res.json();
      if (data.success) {
        setModels(data.models);
      } else {
        setError(data.error || "Failed to load models");
        toast.error("Failed to load models");
      }
    } catch (error) {
      console.error("Failed to load models:", error);
      setError("Network error");
      toast.error("Network error loading models");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadModels();
    const interval = setInterval(loadModels, 5000); // Refresh every 5s
    return () => clearInterval(interval);
  }, []);

  // Start training
  const handleStartTraining = async () => {
    if (!modelName.trim()) {
      toast.error("Please enter a model name");
      return;
    }

    setTraining(true);
    try {
      const res = await fetch("/api/ai/train", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelName,
          symbol: "XAUUSD",
          timeframe,
          fromDate,
          toDate,
          strategy,
          epochs: 100,
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(`Training started: ${data.message}`);
        setModelName("");
        loadModels();
      } else {
        toast.error(`Training failed: ${data.error}`);
      }
    } catch (error) {
      console.error("Training error:", error);
      toast.error("Failed to start training");
    } finally {
      setTraining(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "trained": return "text-success-green";
      case "training": return "text-gold-primary animate-pulse";
      case "failed": return "text-warning-red";
      default: return "text-text-muted";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "trained": return "✓";
      case "training": return "⟳";
      case "failed": return "✗";
      default: return "○";
    }
  };

  return (
    <div className="space-y-4">
      {/* Error Banner */}
      {error && (
        <div className="bg-warning-red/10 border border-warning-red/30 rounded-lg p-3 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-warning-red flex-shrink-0" />
          <p className="text-sm text-warning-red">{error}</p>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Brain className="w-6 h-6 text-accent-purple" />
          <h2 className="text-xl font-bold text-text-primary">AI Model Training</h2>
        </div>
        <div className="flex items-center gap-2 text-sm text-text-muted">
          <Activity className="w-4 h-4" />
          <span>{models.length} models</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Training Form */}
        <div className="bg-background-secondary rounded-lg border border-border-color p-4">
          <h3 className="text-base font-semibold text-text-primary mb-4 flex items-center gap-2">
            <Upload className="w-4 h-4 text-gold-primary" />
            Train New Model
          </h3>
          
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                Model Name
              </label>
              <input
                type="text"
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                placeholder="e.g., GoldScalper_v2"
                className="w-full px-3 py-2 bg-background-tertiary border border-border-color rounded text-sm text-text-primary focus:outline-none focus:border-gold-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                Strategy
              </label>
              <select
                value={strategy}
                onChange={(e) => setStrategy(e.target.value as any)}
                className="w-full px-3 py-2 bg-background-tertiary border border-border-color rounded text-sm text-text-primary focus:outline-none focus:border-gold-primary"
              >
                <option value="scalping">Scalping</option>
                <option value="swing">Swing Trading</option>
                <option value="trend">Trend Following</option>
                <option value="mean_reversion">Mean Reversion</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                Timeframe
              </label>
              <select
                value={timeframe}
                onChange={(e) => setTimeframe(e.target.value)}
                className="w-full px-3 py-2 bg-background-tertiary border border-border-color rounded text-sm text-text-primary focus:outline-none focus:border-gold-primary"
              >
                <option value="M1">M1 (1 min)</option>
                <option value="M5">M5 (5 min)</option>
                <option value="M15">M15 (15 min)</option>
                <option value="M30">M30 (30 min)</option>
                <option value="H1">H1 (1 hour)</option>
                <option value="H4">H4 (4 hours)</option>
                <option value="D1">D1 (Daily)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  From Date
                </label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full px-3 py-2 bg-background-tertiary border border-border-color rounded text-sm text-text-primary focus:outline-none focus:border-gold-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  To Date
                </label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full px-3 py-2 bg-background-tertiary border border-border-color rounded text-sm text-text-primary focus:outline-none focus:border-gold-primary"
                />
              </div>
            </div>

            <button
              onClick={handleStartTraining}
              disabled={training}
              className="w-full px-4 py-2.5 bg-gold-primary text-background-primary rounded font-semibold hover:bg-gold-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {training ? (
                <>
                  <div className="w-4 h-4 border-2 border-background-primary border-t-transparent rounded-full animate-spin" />
                  Training...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Start Training
                </>
              )}
            </button>
          </div>
        </div>

        {/* Models List */}
        <div className="lg:col-span-2 bg-background-secondary rounded-lg border border-border-color">
          <div className="p-4 border-b border-border-color flex items-center justify-between">
            <h3 className="text-base font-semibold text-text-primary flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-success-green" />
              Trained Models
            </h3>
            <button
              onClick={loadModels}
              className="text-xs px-3 py-1.5 bg-background-tertiary text-text-secondary rounded hover:bg-background-tertiary/70 transition-colors"
            >
              Refresh
            </button>
          </div>

          <div className="p-4">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-2 border-gold-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : models.length === 0 ? (
              <div className="text-center py-12 text-text-muted">
                <Brain className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No models trained yet</p>
                <p className="text-sm mt-1">Train your first model to get started</p>
              </div>
            ) : (
              <div className="space-y-3">
                {models.map((model) => (
                  <div
                    key={model.id}
                    className="bg-background-tertiary rounded-lg border border-border-color p-4 hover:border-gold-primary/30 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-semibold text-text-primary">{model.name}</h4>
                        <p className="text-sm text-text-muted mt-0.5">
                          {model.strategy} • {model.symbol} • {model.timeframe}
                        </p>
                      </div>
                      <span className={`text-lg ${getStatusColor(model.status)}`}>
                        {getStatusIcon(model.status)}
                      </span>
                    </div>

                    {model.trainingData && (
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <span className="text-text-muted">Bars:</span>{" "}
                          <span className="text-text-primary font-medium">
                            {model.trainingData.barCount.toLocaleString()}
                          </span>
                        </div>
                        <div>
                          <span className="text-text-muted">Accuracy:</span>{" "}
                          <span className="text-success-green font-medium">
                            {model.accuracy.toFixed(1)}%
                          </span>
                        </div>
                        {model.trainingData.metrics && (
                          <>
                            <div>
                              <span className="text-text-muted">Precision:</span>{" "}
                              <span className="text-text-primary">
                                {(model.trainingData.metrics.precision * 100).toFixed(1)}%
                              </span>
                            </div>
                            <div>
                              <span className="text-text-muted">Recall:</span>{" "}
                              <span className="text-text-primary">
                                {(model.trainingData.metrics.recall * 100).toFixed(1)}%
                              </span>
                            </div>
                            <div>
                              <span className="text-text-muted">F1 Score:</span>{" "}
                              <span className="text-text-primary">
                                {(model.trainingData.metrics.f1Score * 100).toFixed(1)}%
                              </span>
                            </div>
                            <div>
                              <span className="text-text-muted">Loss:</span>{" "}
                              <span className="text-text-primary">
                                {model.trainingData.metrics.loss.toFixed(4)}
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    <div className="mt-3 pt-3 border-t border-border-color flex items-center justify-between">
                      <span className={`text-xs px-2 py-1 rounded ${getStatusColor(model.status)} bg-background-primary`}>
                        {model.status.toUpperCase()}
                      </span>
                      <button className="text-xs px-3 py-1 bg-gold-primary/10 text-gold-primary rounded hover:bg-gold-primary/20 transition-colors">
                        View Details
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}