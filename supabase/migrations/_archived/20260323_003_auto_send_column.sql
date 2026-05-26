-- Migration: Ajouter la colonne auto_send à automation_rules
-- Phase B relances : permet l'envoi automatique d'emails sans validation agent
-- Par défaut false — l'agent doit activer explicitement l'envoi auto par règle

ALTER TABLE automation_rules ADD COLUMN IF NOT EXISTS auto_send BOOLEAN DEFAULT false;
