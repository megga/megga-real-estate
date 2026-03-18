import { useState, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Building2, Home } from 'lucide-react'
import OnboardingLayout, { type OnboardingStep } from './OnboardingLayout'
import { TextField, SelectField } from './formFields'
import { CANTONS } from '@/lib/constants'

const STEPS: OnboardingStep[] = [
  { id: 1, label: 'Société', icon: Building2 },
  { id: 2, label: 'Projet', icon: Home },
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
  type_bien: z.enum(['apartment', 'house', 'villa', 'commercial', 'land'], { message: 'Sélectionnez un type de bien' }),
  budget_min: z.coerce.number().min(0, 'Budget minimum requis'),
  budget_max: z.coerce.number().min(1000, 'Budget maximum requis'),
  localisation: z.string().min(2, 'La localisation est requise'),
  surface_min: z.coerce.number().min(1, 'Surface minimum requise'),
  delai_achat: z.string().min(1, 'Sélectionnez un délai'),
  financement: z.enum(['fonds_propres', 'hypotheque', 'les_deux'], { message: 'Sélectionnez un mode de financement' }),
  usage: z.enum(['propre_usage', 'investissement', 'location'], { message: "Sélectionnez l'usage prévu" }),
})

const fullSchema = step1Schema.merge(step2Schema)
type FormData = z.infer<typeof fullSchema>

const stepSchemas = [step1Schema, step2Schema] as const

export default function OnboardingBuyerPM() {
  const [step, setStep] = useState(1)
  const [isComplete, setIsComplete] = useState(false)

  const form = useForm<FormData>({
    mode: 'onTouched',
    defaultValues: {
      raison_sociale: '', numero_ide: '', siege_social: '',
      ville_siege: '', code_postal_siege: '',
      representant_prenom: '', representant_nom: '', representant_fonction: '',
      telephone: '', email: '', secteur_activite: '',
      type_bien: undefined, budget_min: undefined as unknown as number,
      budget_max: undefined as unknown as number,
      localisation: '', surface_min: undefined as unknown as number,
      delai_achat: '', financement: undefined, usage: undefined,
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
      title="Formulaire acquéreur — Personne morale"
      subtitle="Informations de votre société pour constituer le dossier"
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

          <TextField label="Raison sociale" id="raison_sociale" register={register} errors={errors} placeholder="Immobilière Léman SA" required />

          <TextField label="Numéro IDE / Registre du commerce" id="numero_ide" register={register} errors={errors} placeholder="CHE-123.456.789" required />

          <TextField label="Adresse du siège social" id="siege_social" register={register} errors={errors} placeholder="Rue du Rhône 14" required />

          <div className="grid grid-cols-2 gap-4">
            <TextField label="Code postal" id="code_postal_siege" register={register} errors={errors} placeholder="1204" required />
            <TextField label="Ville" id="ville_siege" register={register} errors={errors} placeholder="Genève" required />
          </div>

          <div className="border-t border-border pt-4 mt-6">
            <h3 className="text-sm font-semibold text-primary-800 mb-3">Représentant légal</h3>
            <div className="grid grid-cols-2 gap-4">
              <TextField label="Prénom" id="representant_prenom" register={register} errors={errors} placeholder="Marc" required />
              <TextField label="Nom" id="representant_nom" register={register} errors={errors} placeholder="Bonvin" required />
            </div>
            <TextField label="Fonction" id="representant_fonction" register={register} errors={errors} placeholder="Directeur général" required className="mt-4" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <TextField label="Téléphone" id="telephone" register={register} errors={errors} type="tel" placeholder="+41 22 300 45 67" required />
            <TextField label="E-mail" id="email" register={register} errors={errors} type="email" placeholder="contact@societe.ch" required />
          </div>

          <TextField label="Secteur d'activité" id="secteur_activite" register={register} errors={errors} placeholder="Immobilier, finance, etc." required />
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-primary-900 mb-4">Projet d'acquisition</h2>

          <SelectField
            label="Type de bien recherché" id="type_bien" register={register} errors={errors} required
            options={[
              { value: 'apartment', label: 'Appartement' },
              { value: 'house', label: 'Maison' },
              { value: 'villa', label: 'Villa' },
              { value: 'commercial', label: 'Commercial' },
              { value: 'land', label: 'Terrain' },
            ]}
          />

          <div className="grid grid-cols-2 gap-4">
            <TextField label="Budget minimum (CHF)" id="budget_min" register={register} errors={errors} type="number" placeholder="1000000" required />
            <TextField label="Budget maximum (CHF)" id="budget_max" register={register} errors={errors} type="number" placeholder="5000000" required />
          </div>

          <SelectField
            label="Localisation souhaitée" id="localisation" register={register} errors={errors} required
            options={CANTONS.map((c) => ({ value: c, label: c }))}
            placeholder="Sélectionnez un canton"
          />

          <TextField label="Surface minimum (m²)" id="surface_min" register={register} errors={errors} type="number" placeholder="200" required />

          <SelectField
            label="Usage prévu" id="usage" register={register} errors={errors} required
            options={[
              { value: 'propre_usage', label: 'Propre usage' },
              { value: 'investissement', label: 'Investissement' },
              { value: 'location', label: 'Mise en location' },
            ]}
          />

          <SelectField
            label="Délai d'achat souhaité" id="delai_achat" register={register} errors={errors} required
            options={[
              { value: 'immediat', label: 'Immédiat' },
              { value: '3_mois', label: 'Dans les 3 mois' },
              { value: '6_mois', label: 'Dans les 6 mois' },
              { value: '12_mois', label: 'Dans les 12 mois' },
              { value: 'pas_presse', label: 'Pas pressé' },
            ]}
          />

          <SelectField
            label="Mode de financement" id="financement" register={register} errors={errors} required
            options={[
              { value: 'fonds_propres', label: 'Fonds propres' },
              { value: 'hypotheque', label: 'Hypothèque' },
              { value: 'les_deux', label: 'Fonds propres + Hypothèque' },
            ]}
          />
        </div>
      )}
    </OnboardingLayout>
  )
}
