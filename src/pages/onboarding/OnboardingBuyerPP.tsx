import { useState, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { User, Briefcase, Home } from 'lucide-react'
import OnboardingLayout, { type OnboardingStep } from './OnboardingLayout'
import { TextField, SelectField } from './formFields'
import { CANTONS } from '@/lib/constants'
import { useContacts } from '@/hooks/useContacts'

const STEPS: OnboardingStep[] = [
  { id: 1, label: 'Identité', icon: User },
  { id: 2, label: 'Situation', icon: Briefcase },
  { id: 3, label: 'Projet', icon: Home },
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
  profession: z.string().min(2, 'La profession est requise'),
  employeur: z.string().optional(),
  revenu_annuel: z.string().min(1, 'Sélectionnez une fourchette'),
  situation_familiale: z.enum(['celibataire', 'marie', 'pacse', 'divorce', 'veuf'], { message: 'Sélectionnez votre situation' }),
  residence_fiscale: z.string().min(2, 'La résidence fiscale est requise'),
})

const step3Schema = z.object({
  type_bien: z.enum(['apartment', 'house', 'villa', 'commercial', 'land'], { message: 'Sélectionnez un type de bien' }),
  budget_min: z.coerce.number().min(0, 'Budget minimum requis'),
  budget_max: z.coerce.number().min(1000, 'Budget maximum requis'),
  localisation: z.string().min(2, 'La localisation est requise'),
  pieces: z.string().min(1, 'Sélectionnez le nombre de pièces'),
  delai_achat: z.string().min(1, 'Sélectionnez un délai'),
  financement: z.enum(['fonds_propres', 'hypotheque', 'les_deux'], { message: 'Sélectionnez un mode de financement' }),
})

type FormData = z.infer<typeof step1Schema> & z.infer<typeof step2Schema> & z.infer<typeof step3Schema>

const stepSchemas = [step1Schema, step2Schema, step3Schema] as const

export default function OnboardingBuyerPP() {
  const [step, setStep] = useState(1)
  const [isComplete, setIsComplete] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const { createFromOnboarding, isCreating } = useContacts()

  const form = useForm<FormData>({
    mode: 'onTouched',
    defaultValues: {
      civilite: undefined,
      prenom: '', nom: '', date_naissance: '', nationalite: 'Suisse',
      adresse: '', ville: '', code_postal: '', telephone: '', email: '',
      profession: '', employeur: '', revenu_annuel: '',
      situation_familiale: undefined, residence_fiscale: 'Suisse',
      type_bien: undefined, budget_min: undefined as unknown as number,
      budget_max: undefined as unknown as number,
      localisation: '', pieces: '', delai_achat: '', financement: undefined,
    },
  })

  const { register, formState: { errors }, setError, clearErrors } = form

  const handleNext = useCallback(async () => {
    const schema = stepSchemas[step - 1]
    const values = form.getValues()
    const result = schema.safeParse(values)
    if (!result.success) {
      for (const issue of result.error.issues) {
        const path = issue.path[0] as keyof FormData
        setError(path, { message: issue.message })
      }
      return
    }
    const fields = Object.keys(schema.shape) as (keyof FormData)[]
    fields.forEach((f) => clearErrors(f))
    if (step < 3) {
      setStep(step + 1)
    } else {
      try {
        setSubmitError(null)
        const values = form.getValues()
        await createFromOnboarding({
          firstName: values.prenom,
          lastName: values.nom,
          email: values.email,
          phone: values.telephone,
          type: 'buyer',
          entityType: 'pp',
          formData: values as unknown as Record<string, unknown>,
        })
        setIsComplete(true)
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : 'Une erreur est survenue lors de l\'envoi')
      }
    }
  }, [step, createFromOnboarding, form, setError, clearErrors])

  const handlePrev = useCallback(() => {
    if (step > 1) setStep(step - 1)
  }, [step])

  return (
    <OnboardingLayout
      title="Formulaire acquéreur — Personne physique"
      subtitle="Remplissez vos informations pour constituer votre dossier"
      steps={STEPS}
      currentStep={step}
      isComplete={isComplete}
      onPrev={step > 1 ? handlePrev : undefined}
      onNext={handleNext}
      nextLabel={step === 3 ? 'Envoyer le dossier' : 'Continuer'}
      isSubmitting={isCreating}
      submitError={submitError}
    >
      {step === 1 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-primary-900 mb-4">Identité</h2>

          <SelectField
            label="Civilité" id="civilite" register={register} errors={errors} required
            options={[
              { value: 'M.', label: 'M.' },
              { value: 'Mme', label: 'Mme' },
              { value: 'Autre', label: 'Autre' },
            ]}
          />

          <div className="grid grid-cols-2 gap-4">
            <TextField label="Prénom" id="prenom" register={register} errors={errors} placeholder="Jean" required />
            <TextField label="Nom" id="nom" register={register} errors={errors} placeholder="Dupont" required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <TextField label="Date de naissance" id="date_naissance" register={register} errors={errors} type="date" required />
            <TextField label="Nationalité" id="nationalite" register={register} errors={errors} placeholder="Suisse" required />
          </div>

          <TextField label="Adresse" id="adresse" register={register} errors={errors} placeholder="Rue de la Gare 12" required />

          <div className="grid grid-cols-2 gap-4">
            <TextField label="Code postal" id="code_postal" register={register} errors={errors} placeholder="1201" required />
            <TextField label="Ville" id="ville" register={register} errors={errors} placeholder="Genève" required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <TextField label="Téléphone" id="telephone" register={register} errors={errors} type="tel" placeholder="+41 79 123 45 67" required />
            <TextField label="E-mail" id="email" register={register} errors={errors} type="email" placeholder="jean.dupont@email.ch" required />
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-primary-900 mb-4">Situation professionnelle et personnelle</h2>

          <TextField label="Profession" id="profession" register={register} errors={errors} placeholder="Ingénieur informatique" required />
          <TextField label="Employeur" id="employeur" register={register} errors={errors} placeholder="Nom de l'entreprise (facultatif)" />

          <SelectField
            label="Revenu annuel brut" id="revenu_annuel" register={register} errors={errors} required
            options={[
              { value: 'moins_80k', label: 'Moins de CHF 80\'000' },
              { value: '80k_120k', label: 'CHF 80\'000 – 120\'000' },
              { value: '120k_180k', label: 'CHF 120\'000 – 180\'000' },
              { value: '180k_250k', label: 'CHF 180\'000 – 250\'000' },
              { value: '250k_500k', label: 'CHF 250\'000 – 500\'000' },
              { value: 'plus_500k', label: 'Plus de CHF 500\'000' },
            ]}
          />

          <SelectField
            label="Situation familiale" id="situation_familiale" register={register} errors={errors} required
            options={[
              { value: 'celibataire', label: 'Célibataire' },
              { value: 'marie', label: 'Marié(e)' },
              { value: 'pacse', label: 'Pacsé(e)' },
              { value: 'divorce', label: 'Divorcé(e)' },
              { value: 'veuf', label: 'Veuf/Veuve' },
            ]}
          />

          <TextField label="Résidence fiscale" id="residence_fiscale" register={register} errors={errors} placeholder="Suisse" required />
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-primary-900 mb-4">Votre projet immobilier</h2>

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
            <TextField label="Budget minimum (CHF)" id="budget_min" register={register} errors={errors} type="number" placeholder="500000" required />
            <TextField label="Budget maximum (CHF)" id="budget_max" register={register} errors={errors} type="number" placeholder="1200000" required />
          </div>

          <SelectField
            label="Localisation souhaitée" id="localisation" register={register} errors={errors} required
            options={CANTONS.map((c) => ({ value: c, label: c }))}
            placeholder="Sélectionnez un canton"
          />

          <SelectField
            label="Nombre de pièces" id="pieces" register={register} errors={errors} required
            options={[
              { value: '1-2', label: '1 – 2 pièces' },
              { value: '2.5-3.5', label: '2.5 – 3.5 pièces' },
              { value: '4-5', label: '4 – 5 pièces' },
              { value: '5.5-7', label: '5.5 – 7 pièces' },
              { value: '7+', label: '7+ pièces' },
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
