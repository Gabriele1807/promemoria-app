import type { ButtonHTMLAttributes } from 'react';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  // Il testo è obbligatorio: nessun pulsante con sola icona (CLAUDE.md).
  testo: string;
};

export default function BottoneGrande({ testo, className, ...resto }: Props) {
  return (
    <button type="button" className={['bottone-grande', className].filter(Boolean).join(' ')} {...resto}>
      {testo}
    </button>
  );
}
