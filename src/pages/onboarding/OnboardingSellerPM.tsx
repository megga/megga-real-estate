import { useState, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Building2, Home } from 'lucide-react'
import OnboardingLayout, { type OnboardingStep } from './OnboardingLayout'
import { TextField, SelectField } from './formFields'
import { CANTONS } from '@/lib/constants'

const STEPS: OnboardingStep[] = [
  { id: 1, label: 'Société', icon: Building2 },
  { id: 2, label: 'Votre bien', icon: Home },
]

const step1Schema = z.object({
  raison_sociale: z.string().min(2, 'La raison sociale est requise'),
  numero_ide: z.string().min(3, 'Le numéro IDE/RC est requis'),
  siege_social: z.string().min(3, "L'adresse du siège est requise"),
  ville_siege: z.string().min(2, 'La ville est requise'),
  code_postal_siege: z.string().min(4, 'Code postal requis').max(4, '4 chiffres'),
  representant_prenom: z.string().min(2, 'Le prénom est requis'),
  representant_nom: z.string().min(2, 'Le nom est requis'),
  representant_fonction: z.string().min(2, 'La fonction est requise'),
  telephone: z.string().min(10, 'Numéro de téléphone invalide'),
  email: z.string().email('Adresse e-mail invalide'),
  secteur_activite: z.string().min(2, "Le secteur d'activité est requis"),
})

const step2Schema = z.object({
  bien_adresse: z.string().min(3, "L'adresse du bien est requise"),
  bien_ville: z.string().min(2, 'La ville est requise'),
  bien_canton: z.string().min(2, 'Le canton est requis'),
  bien_code_postal: z.string().min(4, 'Code postal requis').max(4, '4 chiffres'),
  bien_type: z.enum(['apartment', 'house', 'villa', 'commercial', 'land'], { message: 'Sélectionnez un type de bien' }),
  bien_surface: z.coerce.number().min(5, 'Surface requise (m²)'),
  estimation_prix: z.coerce.number().min(1000, 'Estimation requise'),
  raison_vente: z.string().min(3, 'Indiquez la raison de la vente'),
  delai_vente: z.string().min(1, 'Sélectionnez un délai'),
  mandat_existant: z.enum(['oui', 'non'], { message: 'Indiquez si un mandat existe' }),
  revenus_locatifs: z.string().optional(),
})

const fullSchema = step1Schema.merge(step2Schema)
type FormData = z.infer<typeof fullSchema>

const stepSchemas = [step1Schema, step2Schema] as const

export default function OnboardingSellerPM() {
  const [step, setStep] = useState(1)
  const [isComplete, setIsComplete] = useState(false)

  const form = useForm<FormData>({
    mode: 'onTouched',
    defaultValues: {
      raison_sociale: '', numero_ide: '', siege_social: '',
      ville_siege: '', code_postal_siege: '',
      representant_prenom: '', representant_nom: '', representant_fonction: '',
      telephone: '', email: '', secteur_activite: '',
      bien_adresse: '', bien_ville: '', bien_canton: '', bien_code_postal: '',
      bien_type: undefined, bien_surface: undefined as unknown as number,
      estimation_prix: undefined as unknown as number, raison_vente: '', delai_vente: '',
      mandat_existant: undefined, revenus_locatifs: '',
    },
  })

  const { register, formState: { errors }, setError, clearErrors } = form

  function validateStep(): boolean {
    const schema = stepSchemas[step - 1]
    const values = form.getValues()
    const result = schema.safeParse(values)
    if (!result.success) {
      for (const issue of result.error.issues) {
        const path = issue.path[0] as keyof FormData
        setError(path, { message: issue.message })
      }
      return false
    }
    const fields = Object.keys(schema.shape) as (keyof FormData)[]
    fields.forEach((f) => clearErrors(f))
    return true
  }

  const handleNext = useCallback(() => {
    if (!validateStep()) return
    if (step < 2) {
      setStep(step + 1)
    } else {
      setIsComplete(true)
    }
  }, [step])

  const handlePrev = useCallback(() => {
    if (step > 1) setStep(step - 1)
  }, [step])

  return (
    <OnboardingLayout
      title="Formulaire vendeur — Personne morale"
      subtitle="Informations de votre société et du bien à vendre"
      steps={STEPS}
      currentStep={step}
      isComplete={isComplete}
      onPrev={step > 1 ? handlePrev : undefined}
      onNext={handleNext}
      nextLabel={step === 2 ? 'Envoyer le dossier' : 'Continuer'}
    >
      {step === 1 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-primary-900 mb-4">Informations de la société</h2>

          <TextField label="Raison sociale" id="raison_sociale" register={register} errors={errors} placeholder="Régie du Rhône Sàrl" required />

          <TextField label="Numéro IDE / Registre du commerce" id="numero_ide" register={register} errors={errors} placeholder="CHE-987.654.321" required />

          <TextField label="Adresse du siège social" id="siege_social" register={register} errors={errors} placeholder="Boulevard des Philosophes 22" required />

          <div className="grid grid-cols-2 gap-4">
            <TextField label="Code postal" id="code_postal_siege" register={register} errors={errors} placeholder="1205" required />
            <TextField label="Ville" id="ville_siege" register={register} errors={errors} placeholder="Genève" required />
          </div>

          <div className="border-t border-border pt-4 mt-6">
            <h3 className="text-sm font-semibold text-primary-800 mb-3">Représentant légal</h3>
            <div className="grid grid-cols-2 gap-4">
              <TextField label="Prénom" id="representant_prenom" register={register} errors={errors} placeholder="Paul" required />
              <TextField label="Nom" id="representant_nom" register={register} errors={errors} placeholder="Müller" required />
            </div>
            <TextField label="Fonction" id="representant_fonction" register={register} errors={errors} placeholder="Gérant" required className="mt-4" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <TextField label="Téléphone" id="telephone" register={register} errors={errors} type="tel" placeholder="+41 22 700 12 34" required />
            <TextField label="E-mail" id="email" register={register} errors={errors} type="email" placeholder="info@regie-rhone.ch" required />
          </div>

          <TextField label="Secteur d'activité" id="secteur_activite" register={register} errors={errors} placeholder="Gestion immobilière" required />
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-primary-900 mb-4">Informations sur le bien à vendre</h2>

          <TextField label="Adresse du bien" id="bien_adresse" register={register} errors={errors} placeholder="Place du Marché 5" required />

          <div className="grid grid-cols-3 gap-4">
            <TextField label="Code postal" id="bien_code_postal" register={register} errors={errors} placeholder="1227" required />
            <TextField label="Ville" id="bien_ville" register={register} errors={errors} placeholder="Carouge" required />
            <SelectField
              label="Canton" id="bien_canton" register={register} errors={errors} required
              options={CANTONS.map((c) => ({ value: c, label: c }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <SelectField
              label="Type de bien" id="bien_type" register={register} errors={errors} required
              options={[
                { value: 'apartment', label: 'Appartement / Immeuble' },
                { value: 'house', label: 'Maison' },
                { value: 'villa', label: 'Villa' },
                { value: 'commercial', label: 'Commercial / Arcade' },
                { value: 'land', label: 'Terrain' },
              ]}
            />
            <TextField label="Surface totale (m²)" id="bien_surface" register={register} errors={errors} type="number" placeholder="350" required />
          </div>

          <TextField label="Estimation du prix (CHF)" id="estimation_prix" register={register} errors={errors} type="number" placeholder="2500000" required />

          <TextField label="Revenus locatifs annuels (CHF, si applicable)" id="revenus_locatifs" register={register} errors={errors} placeholder="120000" />

          <TextField label="Raison de la vente" id="raison_vente" register={register} errors={errors} placeholder="Réorganisation du portefeuille, etc." required />

          <SelectField
            label="Délai de vente souhaité" id="delai_vente" register={register} errors={errors} required
            options={[
              { value: 'urgent', label: 'Urgent (< 1 mois)' },
              { value: '3_mois', label: 'Dans les 3 mois' },
              { value: '6_mois', label: 'Dans les 6 mois' },
              { value: '12_mois', label: 'Dans les 12 mois' },
              { value: 'pas_presse', label: 'Pas pressé' },
            ]}
          />

          <SelectField
            label="Mandat existant avec une agence ?" id="mandat_existant" register={register} errors={errors} required
            options={[
              { value: 'oui', label: 'Oui' },
              { value: 'non', label: 'Non' },
            ]}
          />
        </div>
      )}
    </OnboardingLayout>
  )
}
