import { useTerminology } from '@/contexts/TerminologyContext';
import { Gender } from '@/config/terminology';
import type { Staff } from '@/types';

/**
 * Hook per ottenere terminologia specifica per uno staff member
 * 
 * Uso:
 * const { professionalLabel, selectLabel } = useStaffTerminology(selectedStaff);
 */
export function useStaffTerminology(staff: Staff | null | undefined) {
    const terminology = useTerminology();

    if (!staff) {
        // Default a neutro se non c'è staff selezionato
        return {
            ...terminology,
            professionalLabel: terminology.professional(),
            selectLabel: terminology.selectProfessional(),
            articleLabel: terminology.professionalArticle(),
            notAvailableLabel: terminology.professionalNotAvailable(),
        };
    }

    const gender: Gender = staff.gender || 'neutral';

    return {
        ...terminology,
        professionalLabel: terminology.professional(gender),
        selectLabel: terminology.selectProfessional(gender),
        articleLabel: terminology.professionalArticle(gender),
        notAvailableLabel: terminology.professionalNotAvailable(gender),
    };
}
