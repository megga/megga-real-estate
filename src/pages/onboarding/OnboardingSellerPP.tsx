import { useState, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { User, Home } from 'lucide-react'
import OnboardingLayout, { type OnboardingStep } from './OnboardingLayout'
import { TextField, SelectField } from './formFields'
import { CANTONS } from '@/lib/constants'

const STEPS: OnboardingStep[] = [
  { id: 1, label: 'Identité', icon: User },
  { id: 2, label: 'Votre bien', icon: Home },
]

const step1Schema = z.object({
  civilite: z.enum(['M.', 'Mme', 'Autre'], { message: 'Sélectionnez une civilité' }),
  prenom: z.string().min(2, 'Le prénom est requis'),
  nom: z.string().min(2, 'Le nom est requis'),
  date_naissance: z.string().min(1, 'La date de naissance est requise'),
  nationalite: z.string().min(2, 'La nationalité est requise'),
  adresse: z.string().min(3, "L'adresse est requise"),
  ville: z.string().min(2, 'La ville est requise'),
  code_postal: z.string().min(4, 'Code postal requis').max(4, '4 chiffres'),
  telephone: z.string().min(10, 'Numéro de téléphone invalide'),
  email: z.string().email('Adresse e-mail invalide'),
})

const step2Schema = z.object({
  bien_adresse: z.string().min(3, "L'adresse du bien est requise"),
  bien_ville: z.string().min(2, 'La ville est requise'),
  bien_canton: z.string().min(2, 'Le canton est requis'),
  bien_code_postal: z.string().min(4, 'Code postal requis').max(4, '4 chiffres'),
  bien_type: z.enum(['apartment', 'house', 'villa', 'commercial', 'land'], { message: 'Sélectionnez un type de bien' }),
  bien_pieces: z.string().min(1, 'Nombre de pièces requis'),
  bien_surface: z.coerce.number().min(5, 'Surface requise (m²)'),
  estimation_prix: z.coerce.number().min(1000, 'Estimation requise'),
  raison_vente: z.string().min(3, 'Indiquez la raison de la vente'),
  delai_vente: z.string().min(1, 'Sélectionnez un délai'),
  mandat_existant: z.enum(['oui', 'non'], { message: 'Indiquez si un mandat existe' }),
})

const fullSchema = step1Schema.merge(step2Schema)
type FormData = z.infer<typeof fullSchema>

const stepSchemas = [step1Schema, step2Schema] as const

export default function OnboardingSellerPP() {
  const [step, setStep] = useState(1)
  const [isComplete, setIsComplete] = useState(false)

  const form = useForm<FormData>({
    mode: 'onTouched',
    defaultValues: {
      civilite: undefined,
      prenom: '', nom: '', date_naissance: '', nationalite: 'Suisse',
      adresse: '', ville: '', code_postal: '', telephone: '', email: '',
      bien_adresse: '', bien_ville: '', bien_canton: '', bien_code_postal: '',
      bien_type: undefined, bien_pieces: '', bien_surface: undefined as unknown as number,
      estimation_prix: undefined as unknown as number, raison_vente: '', delai_vente: '',
      mandat_existant: undefined,
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
      title="Formulaire vendeur — Personne physique"
      subtitle="Remplissez vos informations et celles de votre bien"
      steps={STEPS}
      currentStep={step}
      isComplete={isComplete}
      onPrev={step > 1 ? handlePrev : undefined}
      onNext={handleNext}
      nextLabel={step === 2 ? 'Envoyer le dossier' : 'Continuer'}
    >
      {step === 1 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-primary-900 mb-4">Identité du vendeur</h2>

          <SelectField
            label="Civilité" id="civilite" register={register} errors={errors} required
            options={[
              { value: 'M.', label: 'M.' },
              { value: 'Mme', label: 'Mme' },
              { value: 'Autre', label: 'Autre' },
            ]}
          />

          <div className="grid grid-cols-2 gap-4">
            <TextField label="Prénom" id="prenom" register={register} errors={errors} placeholder="Marie" required />
            <TextField label="Nom" id="nom" register={register} errors={errors} placeholder="Rochat" required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <TextField label="Date de naissance" id="date_naissance" register={register} errors={errors} type="date" required />
            <TextField label="Nationalité" id="nationalite" register={register} errors={errors} placeholder="Suisse" required />
          </div>

          <TextField label="Adresse" id="adresse" register={register} errors={errors} placeholder="Avenue de Champel 45" required />

          <div className="grid grid-cols-2 gap-4">
            <TextField label="Code postal" id="code_postal" register={register} errors={errors} placeholder="1206" required />
            <TextField label="Ville" id="ville" register={register} errors={errors} placeholder="Genève" required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <TextField label="Téléphone" id="telephone" register={register} errors={errors} type="tel" placeholder="+41 79 456 78 90" required />
            <TextField label="E-mail" id="email" register={register} errors={errors} type="email" placeholder="marie.rochat@email.ch" required />
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-primary-900 mb-4">Informations sur votre bien</h2>

          <TextField label="Adresse du bien" id="bien_adresse" register={register} errors={errors} placeholder="Chemin des Tulipes 8" required />

          <div className="grid grid-cols-3 gap-4">
            <TextField label="Code postal" id="bien_code_postal" register={register} errors={errors} placeholder="1223" required />
            <TextField label="Ville" id="bien_ville" register={register} errors={errors} placeholder="Cologny" required />
            <SelectField
              label="Canton" id="bien_canton" register={register} errors={errors} required
              options={CANTONS.map((c) => ({ value: c, label: c }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <SelectField
              label="Type de bien" id="bien_type" register={register} errors={errors} required
              options={[
                { value: 'apartment', label: 'Appartement' },
                { value: 'house', label: 'Maison' },
                { value: 'villa', label: 'Villa' },
                { value: 'commercial', label: 'Commercial' },
                { value: 'land', label: 'Terrain' },
              ]}
            />
            <SelectField
              label="Nombre de pièces" id="bien_pieces" register={register} errors={errors} required
              options={[
                { value: '1-2', label: '1 – 2 pièces' },
                { value: '2.5-3.5', label: '2.5 – 3.5 pièces' },
                { value: '4-5', label: '4 – 5 pièces' },
                { value: '5.5-7', label: '5.5 – 7 pièces' },
                { value: '7+', label: '7+ pièces' },
              ]}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <TextField label="Surface habitable (m²)" id="bien_surface" register={register} errors={errors} type="number" placeholder="120" required />
            <TextField label="Estimation du prix (CHF)" id="estimation_prix" register={register} errors={errors} type="number" placeholder="1500000" required />
          </div>

          <TextField label="Raison de la vente" id="raison_vente" register={register} errors={errors} placeholder="Déménagement, succession, etc." required />

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
