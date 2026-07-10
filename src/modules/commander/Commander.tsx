import { useState, useEffect, useCallback, useRef } from 'react';
import { useHistory } from 'react-router-dom';
import {
  IonPage, IonContent, IonHeader, IonToolbar, IonIcon,
  IonSpinner, IonModal, IonActionSheet,
} from '@ionic/react';
import { IonIcon as IonIconComponent } from '@ionic/react';
import {
  addOutline, removeOutline, trashOutline,
  cartOutline, closeOutline, logOutOutline,
  sunnyOutline, moonOutline, checkmarkCircleOutline,
  callOutline, fastFoodOutline, alertCircleOutline, checkmarkOutline,
  printOutline, timerOutline,
} from 'ionicons/icons';
import { authService, productsService, ordersService } from '../common/api';
import { useAuth } from '../auth/AuthContext';
import { useTheme } from '../../context/ThemeContext';

// ─── Types ────────────────────────────────────────────────────────────────────
interface SupplementItem {
  _id: string;
  name: { fr: string; ar: string };
  price: number;
  type: 'sauce' | 'size' | 'extra';
}

interface Product {
  _id: string;
  name: { fr: string; ar: string };
  price: number;
  image: string;
  isAvailable: boolean;
  category: { _id: string; name: { fr: string; ar: string }; order: number };
  supplements: SupplementItem[];
}

interface Category {
  _id: string;
  name: { fr: string; ar: string };
  order: number;
}

interface CartEntry {
  key: string;
  product: Product;
  quantity: number;
  supplements: SupplementItem[];
  notes: string;
}

// ─── Theme tokens ─────────────────────────────────────────────────────────────
function makeTokens(isDark: boolean) {
  return isDark ? {
    contentBg:    '#0F172A',
    cardBg:       '#1E293B',
    cardBorder:   'rgba(255,255,255,0.08)',
    cardShadow:   '0 4px 16px rgba(0,0,0,0.4)',
    surf2:        '#334155',
    surf3:        '#475569',
    text1:        '#F1F5F9',
    text2:        '#94A3B8',
    text3:        '#64748B',
    divider:      'rgba(255,255,255,0.08)',
    headerBg:     'linear-gradient(180deg,#1E293B 0%,#0F172A 100%)',
    headerBorder: 'rgba(255,255,255,0.08)',
    titleColor:   '#F1F5F9',
    logoutBg:     'rgba(255,255,255,0.07)',
    logoutBorder: 'rgba(255,255,255,0.09)',
    input:        '#0F172A',
    inputBorder:  'rgba(255,255,255,0.12)',
    sheetBg:      '#1E293B',
    pillBg:       'rgba(255,255,255,0.06)',
    pillBorder:   'rgba(255,255,255,0.10)',
    overlay:      'rgba(0,0,0,0.7)',
  } : {
    contentBg:    '#FAF7F2',
    cardBg:       '#FFFFFF',
    cardBorder:   'rgba(0,0,0,0.08)',
    cardShadow:   '0 2px 12px rgba(0,0,0,0.08)',
    surf2:        '#F8FAFC',
    surf3:        '#E2E8F0',
    text1:        '#1E293B',
    text2:        '#64748B',
    text3:        '#94A3B8',
    divider:      'rgba(0,0,0,0.06)',
    headerBg:     'linear-gradient(180deg,#FFFFFF 0%,#FAF7F2 100%)',
    headerBorder: 'rgba(0,0,0,0.08)',
    titleColor:   '#1E293B',
    logoutBg:     'rgba(0,0,0,0.03)',
    logoutBorder: 'rgba(0,0,0,0.05)',
    input:        '#FFFFFF',
    inputBorder:  'rgba(0,0,0,0.14)',
    sheetBg:      '#FFFFFF',
    pillBg:       'rgba(0,0,0,0.04)',
    pillBorder:   'rgba(0,0,0,0.08)',
    overlay:      'rgba(0,0,0,0.55)',
  };
}

// ─── Order mode type ──────────────────────────────────────────────────────────
type OrderMode = 'sur_place' | 'a_emporter';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function cartKey(productId: string, suppIds: string[]) {
  return `${productId}__${[...suppIds].sort().join('_')}`;
}

function lineTotal(entry: CartEntry) {
  const suppSum = entry.supplements.reduce((s, x) => s + x.price, 0);
  return (entry.product.price + suppSum) * entry.quantity;
}

// ─── Receipt printer ─────────────────────────────────────────────────────────
function printReceipt(orderNumber: string, mode: OrderMode, cartSnap: CartEntry[], total: number, prepMinutes?: number) {
  const now     = new Date();
  const dateStr = now.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  const modeLabel = mode === 'sur_place' ? 'SUR PLACE' : 'A EMPORTER';

  const rows = cartSnap.map(entry => {
    const unitExtra = entry.supplements.reduce((s, x) => s + x.price, 0);
    const unitPrice = entry.product.price + unitExtra;
    const line      = (unitPrice * entry.quantity).toFixed(2);
    const suppLabel = entry.supplements.length
      ? `<div class="supp">${entry.supplements.map(s => s.name.fr).join(', ')}</div>`
      : '';
    const noteLabel = entry.notes
      ? `<div class="note">"${entry.notes}"</div>`
      : '';
    return `
      <tr>
        <td class="qty">x${entry.quantity}</td>
        <td class="name">${entry.product.name.fr}${suppLabel}${noteLabel}</td>
        <td class="price">${line}</td>
      </tr>`;
  }).join('');

  const prepHtml = prepMinutes
    ? `<div class="prep-row">
        <span class="prep-lbl">Temps de preparation</span>
        <span class="prep-val">${prepMinutes >= 60 ? `${Math.floor(prepMinutes / 60)}h${prepMinutes % 60 ? ` ${prepMinutes % 60}min` : ''}` : `${prepMinutes} min`}</span>
       </div>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Recu #${orderNumber}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    width: 100%;
  }
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 13px;
    margin: 0;
    padding: 6px 8px 24px;
    color: #000;
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .brand {
    font-size: 22px;
    font-weight: 900;
    text-align: center;
    letter-spacing: 2px;
    margin-bottom: 2px;
  }
  .tagline { font-size: 10px; text-align: center; color: #444; }
  .dash {
    border: none;
    border-top: 1.5px dashed #000;
    margin: 7px 0;
  }
  .ordnum {
    font-size: 17px;
    font-weight: 900;
    text-align: center;
    letter-spacing: 2px;
    margin: 5px 0 2px;
  }
  .datetime {
    font-size: 11px;
    text-align: center;
    color: #333;
    margin-bottom: 5px;
  }
  .mode {
    font-size: 15px;
    font-weight: 900;
    text-align: center;
    border: 2px solid #000;
    padding: 5px 0;
    margin: 7px 0;
    letter-spacing: 1.5px;
  }
  .section-head {
    font-size: 9px;
    font-weight: 900;
    letter-spacing: 2px;
    text-transform: uppercase;
    margin: 7px 0 4px;
    color: #444;
  }
  table.items { width: 100%; border-collapse: collapse; }
  .qty   { width: 24px; vertical-align: top; font-weight: 900; font-size: 13px; padding-right: 5px; white-space: nowrap; }
  .name  { vertical-align: top; font-size: 13px; line-height: 1.45; word-break: break-word; }
  .price {
    text-align: right; vertical-align: top;
    white-space: nowrap; padding-left: 5px;
    font-weight: 800; font-size: 13px;
    width: 1%;
  }
  td { padding-bottom: 6px; }
  .supp { font-size: 10px; color: #444; margin-top: 2px; }
  .note { font-size: 10px; color: #555; font-style: italic; margin-top: 2px; }
  .tot-label { font-size: 17px; font-weight: 900; padding-top: 4px; }
  .tot-val   { font-size: 17px; font-weight: 900; text-align: right; padding-top: 4px; white-space: nowrap; }
  .thanks { font-size: 11px; text-align: center; margin-top: 10px; letter-spacing: 0.5px; }
  .prep-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #f0f0f0;
    border: 1.5px solid #000;
    border-radius: 3px;
    padding: 5px 8px;
    margin: 6px 0;
  }
  .prep-lbl { font-size: 11px; font-weight: 700; }
  .prep-val { font-size: 14px; font-weight: 900; }
  @media print {
    @page {
      size: 80mm auto;
      margin: 0;
    }
    html, body {
      width: 100%;
      margin: 0;
      padding: 4px 6px 20px;
    }
  }
</style>
</head>
<body>
  <div class="brand">MR. BURRITOS</div>
  <div class="tagline">Commande locale</div>
  <hr class="dash">
  <div class="ordnum">COMMANDE #${orderNumber}</div>
  <div class="datetime">${dateStr} a ${timeStr}</div>
  <div class="mode">&gt;&gt;&gt; ${modeLabel} &lt;&lt;&lt;</div>
  ${prepHtml}
  <hr class="dash">
  <div class="section-head">Articles commandes</div>
  <table class="items"><tbody>${rows}</tbody></table>
  <hr class="dash">
  <table style="width:100%"><tbody>
    <tr>
      <td class="tot-label">TOTAL</td>
      <td class="tot-val">${total.toFixed(2)} DT</td>
    </tr>
  </tbody></table>
  <hr class="dash">
  <div class="thanks">Merci pour votre visite !</div>
</body>
</html>`;

  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0;';
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
  if (doc) {
    doc.open();
    doc.write(html);
    doc.close();
    setTimeout(() => {
      iframe.contentWindow?.print();
      setTimeout(() => document.body.removeChild(iframe), 2_000);
    }, 450);
  }
}

// ─── Product card ─────────────────────────────────────────────────────────────
function ProductCard({
  product, qtyInCart, onTap, T,
}: {
  product: Product;
  qtyInCart: number;
  onTap: (p: Product) => void;
  T: ReturnType<typeof makeTokens>;
}) {
  const unavailable = !product.isAvailable;
  return (
    <div
      onClick={() => !unavailable && onTap(product)}
      style={{
        background: T.cardBg,
        border: `1px solid ${qtyInCart > 0 ? '#F5A800' : T.cardBorder}`,
        borderRadius: 16,
        overflow: 'hidden',
        boxShadow: T.cardShadow,
        opacity: unavailable ? 0.45 : 1,
        cursor: unavailable ? 'not-allowed' : 'pointer',
        position: 'relative',
        transition: 'border 0.15s',
      }}
    >
      {/* Image / placeholder */}
      {product.image ? (
        <img
          src={product.image}
          alt={product.name.fr}
          style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <div style={{
          width: '100%', aspectRatio: '4/3',
          background: `linear-gradient(135deg, rgba(245,168,0,0.12), rgba(255,107,0,0.08))`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 36,
        }}>
          🌯
        </div>
      )}

      {/* Cart qty badge */}
      {qtyInCart > 0 && (
        <div style={{
          position: 'absolute', top: 8, right: 8,
          background: '#F5A800', borderRadius: 12,
          width: 24, height: 24,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 900, fontSize: 13, color: '#000',
          boxShadow: '0 2px 8px rgba(245,168,0,0.5)',
        }}>
          {qtyInCart}
        </div>
      )}

      {/* Unavailable badge */}
      {unavailable && (
        <div style={{
          position: 'absolute', top: 8, left: 8,
          background: 'rgba(239,68,68,0.9)', borderRadius: 8,
          padding: '2px 8px',
        }}>
          <span style={{ fontSize: 10, color: '#fff', fontWeight: 700 }}>Indispo</span>
        </div>
      )}

      {/* Info */}
      <div style={{ padding: '10px 12px 12px' }}>
        <p style={{
          fontSize: 13, color: T.text1, fontWeight: 700,
          margin: '0 0 6px',
          overflow: 'hidden', textOverflow: 'ellipsis',
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          lineHeight: 1.3,
        }}>
          {product.name.fr}
        </p>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 14, color: '#F5A800', fontWeight: 900 }}>
            {product.price.toFixed(2)} DT
          </span>
          <div style={{
            width: 30, height: 30, borderRadius: 10,
            background: unavailable ? T.surf3 : 'linear-gradient(135deg,#F5A800,#FF6B00)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: unavailable ? 'none' : '0 2px 8px rgba(245,168,0,0.4)',
          }}>
            <IonIconComponent icon={addOutline} style={{ fontSize: 18, color: unavailable ? T.text3 : '#000' }} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Supplement Picker (bottom sheet overlay) ─────────────────────────────────
function SupplementPicker({
  product, T, isDark, onAdd, onClose,
}: {
  product: Product;
  T: ReturnType<typeof makeTokens>;
  isDark: boolean;
  onAdd: (qty: number, supps: SupplementItem[], notes: string) => void;
  onClose: () => void;
}) {
  const [qty, setQty]           = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [notes, setNotes]       = useState('');

  const toggleSupp = (id: string) =>
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const suppTotal = product.supplements
    .filter(s => selected.includes(s._id))
    .reduce((s, x) => s + x.price, 0);
  const total = (product.price + suppTotal) * qty;

  const hasSauces = product.supplements.some(s => s.type === 'sauce');
  const hasSizes  = product.supplements.some(s => s.type === 'size');
  const hasExtras = product.supplements.some(s => s.type === 'extra');

  const groupLabel: Record<string, string> = {
    size: 'Taille', sauce: 'Sauce', extra: 'Suppléments',
  };
  const groupColor: Record<string, string> = {
    size: '#8B5CF6', sauce: '#EF4444', extra: '#10B981',
  };

  const groups = [
    hasSizes  && 'size',
    hasSauces && 'sauce',
    hasExtras && 'extra',
  ].filter(Boolean) as string[];

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 500,
        background: T.overlay,
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: T.sheetBg,
          borderRadius: '24px 24px 0 0',
          maxHeight: '85vh',
          display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12 }}>
          <div style={{ width: 40, height: 4, borderRadius: 4, background: T.surf3 }} />
        </div>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 20px 0',
        }}>
          <div>
            <h2 style={{ fontSize: 17, color: T.text1, fontWeight: 800, margin: 0 }}>
              {product.name.fr}
            </h2>
            <p style={{ fontSize: 13, color: '#F5A800', fontWeight: 700, margin: '2px 0 0' }}>
              {product.price.toFixed(2)} DT
            </p>
          </div>
          <button onClick={onClose} style={{
            width: 36, height: 36, borderRadius: 10, border: 'none',
            background: T.surf2, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <IonIconComponent icon={closeOutline} style={{ fontSize: 20, color: T.text2 }} />
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{ overflowY: 'auto', padding: '16px 20px', flex: 1 }}>

          {/* Quantity */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 20,
          }}>
            <span style={{ fontSize: 14, color: T.text1, fontWeight: 700 }}>Quantité</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <button
                onClick={() => setQty(q => Math.max(1, q - 1))}
                style={{
                  width: 36, height: 36, borderRadius: 10, border: 'none', cursor: 'pointer',
                  background: qty === 1 ? T.surf3 : 'rgba(245,168,0,0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <IonIconComponent icon={removeOutline} style={{ fontSize: 20, color: qty === 1 ? T.text3 : '#F5A800' }} />
              </button>
              <span style={{ fontSize: 22, fontWeight: 900, color: T.text1, minWidth: 24, textAlign: 'center' }}>
                {qty}
              </span>
              <button
                onClick={() => setQty(q => Math.min(20, q + 1))}
                style={{
                  width: 36, height: 36, borderRadius: 10, border: 'none', cursor: 'pointer',
                  background: 'rgba(245,168,0,0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <IonIconComponent icon={addOutline} style={{ fontSize: 20, color: '#F5A800' }} />
              </button>
            </div>
          </div>

          {/* Supplements by group */}
          {groups.map(type => (
            <div key={type} style={{ marginBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <div style={{
                  width: 8, height: 8, borderRadius: 4,
                  background: groupColor[type],
                }} />
                <span style={{ fontSize: 12, color: T.text2, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                  {groupLabel[type]}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {product.supplements.filter(s => s.type === type).map(supp => {
                  const isOn = selected.includes(supp._id);
                  return (
                    <div
                      key={supp._id}
                      onClick={() => toggleSupp(supp._id)}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '11px 14px',
                        background: isOn ? `${groupColor[type]}12` : T.surf2,
                        borderRadius: 12,
                        border: `1.5px solid ${isOn ? groupColor[type] : 'transparent'}`,
                        cursor: 'pointer',
                        transition: 'all 0.12s',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 20, height: 20, borderRadius: 6,
                          border: `2px solid ${isOn ? groupColor[type] : T.text3}`,
                          background: isOn ? groupColor[type] : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0,
                          transition: 'all 0.12s',
                        }}>
                          {isOn && <IonIconComponent icon={checkmarkOutline} style={{ fontSize: 13, color: '#fff' }} />}
                        </div>
                        <span style={{ fontSize: 14, color: T.text1, fontWeight: 600 }}>
                          {supp.name.fr}
                        </span>
                      </div>
                      {supp.price > 0 && (
                        <span style={{ fontSize: 13, color: groupColor[type], fontWeight: 700 }}>
                          +{supp.price.toFixed(2)} DT
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Notes */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 13, color: T.text2, fontWeight: 700, display: 'block', marginBottom: 8 }}>
              Note (optionnel)
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Sans oignon, bien grillé..."
              rows={2}
              style={{
                width: '100%', boxSizing: 'border-box',
                background: T.input, border: `1px solid ${T.inputBorder}`,
                borderRadius: 12, color: T.text1, fontSize: 14,
                padding: '12px 14px', resize: 'none', outline: 'none',
                fontFamily: 'inherit',
              }}
            />
          </div>
        </div>

        {/* Add to cart button */}
        <div style={{ padding: '12px 20px 28px' }}>
          <button
            onClick={() => {
              const selSupps = product.supplements.filter(s => selected.includes(s._id));
              onAdd(qty, selSupps, notes);
            }}
            style={{
              width: '100%', padding: '16px',
              background: 'linear-gradient(135deg,#F5A800,#FF6B00)',
              border: 'none', borderRadius: 16, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}
          >
            <span style={{ fontSize: 15, fontWeight: 700, color: '#000' }}>
              Ajouter au panier
            </span>
            <span style={{ fontSize: 16, fontWeight: 900, color: '#000' }}>
              {total.toFixed(2)} DT
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Cart Sheet ───────────────────────────────────────────────────────────────
function CartSheet({
  cart, onClose, onCheckout, onUpdateQty, onRemove, T,
}: {
  cart: CartEntry[];
  onClose: () => void;
  onCheckout: () => void;
  onUpdateQty: (key: string, delta: number) => void;
  onRemove: (key: string) => void;
  T: ReturnType<typeof makeTokens>;
}) {
  const total = cart.reduce((s, e) => s + lineTotal(e), 0);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 500,
        background: T.overlay,
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: T.sheetBg,
          borderRadius: '24px 24px 0 0',
          maxHeight: '80vh',
          display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12 }}>
          <div style={{ width: 40, height: 4, borderRadius: 4, background: T.surf3 }} />
        </div>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 20px',
          borderBottom: `1px solid ${T.divider}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <IonIconComponent icon={cartOutline} style={{ fontSize: 20, color: '#F5A800' }} />
            <span style={{ fontSize: 17, color: T.text1, fontWeight: 800 }}>
              Panier ({cart.reduce((s, e) => s + e.quantity, 0)})
            </span>
          </div>
          <button onClick={onClose} style={{
            width: 34, height: 34, borderRadius: 10, border: 'none',
            background: T.surf2, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <IonIconComponent icon={closeOutline} style={{ fontSize: 18, color: T.text2 }} />
          </button>
        </div>

        {/* Items */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '12px 20px' }}>
          {cart.map(entry => {
            const lt = lineTotal(entry);
            return (
              <div key={entry.key} style={{
                background: T.surf2, borderRadius: 14,
                padding: '12px 14px', marginBottom: 10,
              }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  alignItems: 'flex-start', marginBottom: 8,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      fontSize: 14, color: T.text1, fontWeight: 700, margin: '0 0 2px',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {entry.product.name.fr}
                    </p>
                    {entry.supplements.length > 0 && (
                      <p style={{ fontSize: 11, color: T.text3, margin: '0 0 4px' }}>
                        {entry.supplements.map(s => s.name.fr).join(', ')}
                      </p>
                    )}
                    {entry.notes && (
                      <p style={{ fontSize: 11, color: T.text2, margin: 0, fontStyle: 'italic' }}>
                        "{entry.notes}"
                      </p>
                    )}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 10 }}>
                    <p style={{ fontSize: 14, color: '#F5A800', fontWeight: 900, margin: 0 }}>
                      {lt.toFixed(2)} DT
                    </p>
                    <p style={{ fontSize: 11, color: T.text3, margin: '2px 0 0' }}>
                      {((entry.product.price + entry.supplements.reduce((s, x) => s + x.price, 0))).toFixed(2)} DT/u
                    </p>
                  </div>
                </div>

                {/* Qty controls + delete */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    background: T.surf3, borderRadius: 10, padding: '4px 10px',
                    flex: 1,
                  }}>
                    <button
                      onClick={() => onUpdateQty(entry.key, -1)}
                      style={{
                        width: 28, height: 28, borderRadius: 8, border: 'none', cursor: 'pointer',
                        background: 'rgba(245,168,0,0.15)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <IonIconComponent icon={removeOutline} style={{ fontSize: 16, color: '#F5A800' }} />
                    </button>
                    <span style={{
                      fontSize: 16, fontWeight: 900, color: T.text1,
                      flex: 1, textAlign: 'center',
                    }}>
                      {entry.quantity}
                    </span>
                    <button
                      onClick={() => onUpdateQty(entry.key, +1)}
                      style={{
                        width: 28, height: 28, borderRadius: 8, border: 'none', cursor: 'pointer',
                        background: 'rgba(245,168,0,0.15)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <IonIconComponent icon={addOutline} style={{ fontSize: 16, color: '#F5A800' }} />
                    </button>
                  </div>
                  <button
                    onClick={() => onRemove(entry.key)}
                    style={{
                      width: 38, height: 38, borderRadius: 10, border: 'none', cursor: 'pointer',
                      background: 'rgba(239,68,68,0.1)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <IonIconComponent icon={trashOutline} style={{ fontSize: 18, color: '#EF4444' }} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 20px 28px', borderTop: `1px solid ${T.divider}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
            <span style={{ fontSize: 15, color: T.text2, fontWeight: 600 }}>Total</span>
            <span style={{ fontSize: 18, color: T.text1, fontWeight: 900 }}>{total.toFixed(2)} DT</span>
          </div>
          <button
            onClick={onCheckout}
            style={{
              width: '100%', padding: '16px',
              background: 'linear-gradient(135deg,#10B981,#059669)',
              border: 'none', borderRadius: 16, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            }}
          >
            <IonIconComponent icon={checkmarkCircleOutline} style={{ fontSize: 22, color: '#fff' }} />
            <span style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>Passer la commande</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Checkout form ────────────────────────────────────────────────────────────

function CheckoutForm({
  cart, onClose, onSubmit, submitting, T,
}: {
  cart: CartEntry[];
  onClose: () => void;
  onSubmit: (mode: OrderMode, phone: string) => void;
  submitting: boolean;
  T: ReturnType<typeof makeTokens>;
}) {
  const [mode,  setMode]  = useState<OrderMode>('sur_place');
  const [phone, setPhone] = useState('');
  const total = cart.reduce((s, e) => s + lineTotal(e), 0);

  const modeOptions: { key: OrderMode; emoji: string; label: string; sub: string; color: string }[] = [
    { key: 'sur_place',  emoji: '🪑', label: 'Sur place',   sub: 'Le client mange ici',       color: '#3B82F6' },
    { key: 'a_emporter', emoji: '🛍', label: 'À emporter',  sub: 'Le client emporte la commande', color: '#FF6B00' },
  ];

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 600,
        background: T.overlay,
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: T.sheetBg,
          borderRadius: '24px 24px 0 0',
          display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12 }}>
          <div style={{ width: 40, height: 4, borderRadius: 4, background: T.surf3 }} />
        </div>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 20px 16px',
          borderBottom: `1px solid ${T.divider}`,
        }}>
          <span style={{ fontSize: 17, color: T.text1, fontWeight: 800 }}>Finaliser la commande</span>
          <button onClick={onClose} style={{
            width: 34, height: 34, borderRadius: 10, border: 'none',
            background: T.surf2, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <IonIconComponent icon={closeOutline} style={{ fontSize: 18, color: T.text2 }} />
          </button>
        </div>

        <div style={{ padding: '20px 20px' }}>

          {/* Order summary */}
          <div style={{
            background: 'rgba(245,168,0,0.08)', border: '1px solid rgba(245,168,0,0.2)',
            borderRadius: 14, padding: '12px 16px', marginBottom: 20,
          }}>
            <p style={{ fontSize: 13, color: T.text2, margin: '0 0 4px', fontWeight: 600 }}>
              {cart.reduce((s, e) => s + e.quantity, 0)} article(s)
            </p>
            {cart.map(e => (
              <p key={e.key} style={{ fontSize: 12, color: T.text2, margin: '2px 0' }}>
                ×{e.quantity} {e.product.name.fr}
                {e.supplements.length > 0 && ` (${e.supplements.map(s => s.name.fr).join(', ')})`}
              </p>
            ))}
            <div style={{ borderTop: `1px solid rgba(245,168,0,0.2)`, marginTop: 10, paddingTop: 10 }}>
              <p style={{ fontSize: 15, color: '#F5A800', fontWeight: 900, margin: 0 }}>
                Total : {total.toFixed(2)} DT
              </p>
            </div>
          </div>

          {/* Mode toggle */}
          <p style={{ fontSize: 13, color: T.text2, fontWeight: 700, margin: '0 0 10px' }}>
            Type de commande
          </p>
          <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
            {modeOptions.map(opt => {
              const isOn = mode === opt.key;
              return (
                <div
                  key={opt.key}
                  onClick={() => setMode(opt.key)}
                  style={{
                    flex: 1, padding: '16px 12px', borderRadius: 16, cursor: 'pointer',
                    border: `2px solid ${isOn ? opt.color : T.cardBorder}`,
                    background: isOn ? `${opt.color}12` : T.surf2,
                    textAlign: 'center',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ fontSize: 30, marginBottom: 6 }}>{opt.emoji}</div>
                  <p style={{ fontSize: 15, color: isOn ? opt.color : T.text1, fontWeight: 800, margin: '0 0 4px' }}>
                    {opt.label}
                  </p>
                  <p style={{ fontSize: 11, color: T.text3, margin: 0 }}>{opt.sub}</p>
                </div>
              );
            })}
          </div>

          {/* Phone (optional) */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <IonIconComponent icon={callOutline} style={{ fontSize: 15, color: T.text3 }} />
              <label style={{ fontSize: 13, color: T.text2, fontWeight: 700 }}>
                Téléphone <span style={{ color: T.text3, fontWeight: 500 }}>(optionnel)</span>
              </label>
            </div>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="+216 XX XXX XXX"
              style={{
                width: '100%', boxSizing: 'border-box' as const,
                background: T.input, border: `1px solid ${T.inputBorder}`,
                borderRadius: 12, color: T.text1, fontSize: 15,
                padding: '13px 14px', outline: 'none', fontFamily: 'inherit',
              }}
            />
          </div>
        </div>

        {/* Submit */}
        <div style={{ padding: '0 20px 32px' }}>
          <button
            disabled={submitting}
            onClick={() => onSubmit(mode, phone.trim())}
            style={{
              width: '100%', padding: '16px',
              background: submitting ? T.surf3 : 'linear-gradient(135deg,#10B981,#059669)',
              border: 'none', borderRadius: 16, cursor: submitting ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            }}
          >
            {submitting ? (
              <IonSpinner name="dots" style={{ color: '#fff', width: 24, height: 24 }} />
            ) : (
              <>
                <IonIconComponent icon={checkmarkCircleOutline} style={{ fontSize: 22, color: '#fff' }} />
                <span style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>
                  Confirmer
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function CommanderPage() {
  const history  = useHistory();
  const { logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const T = makeTokens(isDark);

  // Data
  const [products,   setProducts]   = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCat,  setActiveCat]  = useState<string>('all');
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);

  // Cart
  const [cart, setCart] = useState<CartEntry[]>([]);

  // Panels
  const [picker,       setPicker]       = useState<Product | null>(null);
  const [cartOpen,     setCartOpen]     = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [submitting,   setSubmitting]   = useState(false);
  const [success,      setSuccess]      = useState(false);

  // Last submitted order (for reprinting)
  const [lastReceipt, setLastReceipt] = useState<{
    orderNumber: string; mode: OrderMode; cart: CartEntry[]; total: number; prepMinutes?: number;
  } | null>(null);

  // Prep time action sheet
  const [prepSheet, setPrepSheet] = useState<{ open: boolean; mode: OrderMode; phone: string }>
    ({ open: false, mode: 'sur_place', phone: '' });

  // Load products
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data: Product[] = await productsService.getAll();
      setProducts(data);
      // Build unique category list ordered by .order
      const catMap = new Map<string, Category>();
      for (const p of data) {
        if (p.category && !catMap.has(p.category._id)) {
          catMap.set(p.category._id, p.category);
        }
      }
      const sorted = [...catMap.values()].sort((a, b) => a.order - b.order);
      setCategories(sorted);
    } catch {
      setError('Impossible de charger le menu.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authService.isAuthenticated()) { history.push('/login'); return; }
    load();
  }, [history, load]);

  // Cart helpers
  const addToCart = (product: Product, qty: number, supps: SupplementItem[], notes: string) => {
    const key = cartKey(product._id, supps.map(s => s._id));
    setCart(prev => {
      const idx = prev.findIndex(e => e.key === key);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], quantity: updated[idx].quantity + qty };
        return updated;
      }
      return [...prev, { key, product, quantity: qty, supplements: supps, notes }];
    });
    setPicker(null);
  };

  const updateQty = (key: string, delta: number) => {
    setCart(prev => {
      const idx = prev.findIndex(e => e.key === key);
      if (idx < 0) return prev;
      const newQty = prev[idx].quantity + delta;
      if (newQty <= 0) return prev.filter(e => e.key !== key);
      const updated = [...prev];
      updated[idx] = { ...updated[idx], quantity: newQty };
      return updated;
    });
  };

  const removeFromCart = (key: string) =>
    setCart(prev => prev.filter(e => e.key !== key));

  const cartCount = cart.reduce((s, e) => s + e.quantity, 0);
  const cartTotal = cart.reduce((s, e) => s + lineTotal(e), 0);

  // Cart count per product (sum of all entries for that product)
  const cartCountForProduct = (productId: string) =>
    cart.filter(e => e.product._id === productId).reduce((s, e) => s + e.quantity, 0);

  // Product tap: if has supplements → open picker, else add directly
  const handleProductTap = (product: Product) => {
    if (product.supplements && product.supplements.length > 0) {
      setPicker(product);
    } else {
      addToCart(product, 1, [], '');
    }
  };

  // Submit order
  const handleSubmit = async (mode: OrderMode, phone: string, prepMinutes?: number) => {
    setSubmitting(true);
    try {
      const cartSnap  = [...cart];       // snapshot before clearing
      const totalSnap = cartTotal;
      const customerName = mode === 'sur_place' ? 'Sur place' : 'À emporter';
      const items = cartSnap.map(entry => ({
        product: entry.product._id,
        productName: entry.product.name,
        quantity: entry.quantity,
        unitPrice: entry.product.price,
        supplements: entry.supplements.map(s => ({
          supplement: s._id,
          name: s.name,
          price: s.price,
        })),
        notes: entry.notes,
      }));
      const order = await ordersService.create({
        type:     'pickup',
        status:   'confirmed',
        customer: { name: customerName, phone: phone || '-' },
        items,
        subtotal: totalSnap,
        total:    totalSnap,
      });
      // Save prep timer to localStorage so Orders page shows countdown
      if (prepMinutes && order._id) {
        const timerKey = 'mr_burritos_prep_timers';
        const existing = (() => { try { return JSON.parse(localStorage.getItem(timerKey) ?? '{}'); } catch { return {}; } })();
        const endMs    = Date.now() + prepMinutes * 60_000;
        const totalMs  = prepMinutes * 60_000;
        localStorage.setItem(timerKey, JSON.stringify({ ...existing, [order._id]: { endMs, totalMs } }));
      }
      // Store receipt data for reprinting
      const receipt = { orderNumber: order.orderNumber, mode, cart: cartSnap, total: totalSnap, prepMinutes };
      setLastReceipt(receipt);
      // Trigger print
      printReceipt(receipt.orderNumber, receipt.mode, receipt.cart, receipt.total, prepMinutes);
      setCart([]);
      setCheckoutOpen(false);
      setCartOpen(false);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 5000);
    } catch {
      // silent – user can retry
    } finally {
      setSubmitting(false);
    }
  };

  // Open prep time sheet instead of submitting directly
  const openPrepSheet = (mode: OrderMode, phone: string) => {
    setPrepSheet({ open: true, mode, phone });
  };

  // Called after selecting prep time from the action sheet
  const handleConfirmWithTime = (minutes: number) => {
    setPrepSheet(s => ({ ...s, open: false }));
    handleSubmit(prepSheet.mode, prepSheet.phone, minutes);
  };

  // Responsive grid columns
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  useEffect(() => {
    const onResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const gridCols =
    windowWidth >= 1800 ? 'repeat(5, 1fr)' :
    windowWidth >= 1400 ? 'repeat(4, 1fr)' :
    windowWidth >= 1024 ? 'repeat(3, 1fr)' :
    windowWidth >= 600  ? 'repeat(2, 1fr)' :
    '1fr';

  // Filtered products
  const filtered = activeCat === 'all'
    ? products
    : products.filter(p => p.category?._id === activeCat);

  // ── Loading ──
  if (loading) {
    return (
      <IonPage>
        <IonContent style={{ '--background': T.contentBg }}>
          <div style={{
            height: '100%', display: 'flex',
            alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16,
          }}>
            <IonSpinner name="dots" style={{ color: '#F5A800', width: 44, height: 44 }} />
            <p style={{ color: T.text2, fontSize: 14, margin: 0 }}>Chargement du menu…</p>
          </div>
        </IonContent>
      </IonPage>
    );
  }

  return (
    <IonPage>
      {/* ════════════════════ HEADER ════════════════════ */}
      <IonHeader style={{ background: T.headerBg, borderBottom: `1px solid ${T.headerBorder}` }}>
        <IonToolbar style={{
          '--background': 'transparent', '--border-color': 'transparent',
          minHeight: 'auto', padding: '14px 16px 10px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
            <div style={{
              width: 40, height: 40, borderRadius: 13, flexShrink: 0,
              background: 'linear-gradient(135deg,#F5A800,#FF6B00)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 14px rgba(245,168,0,0.45)',
            }}>
              <span style={{ color: '#fff', fontWeight: 900, fontSize: 13 }}>MR</span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ color: T.titleColor, fontWeight: 800, fontSize: 18, letterSpacing: -0.4 }}>
                Commander
              </span>
            </div>
            <button onClick={toggleTheme} style={{
              width: 40, height: 40, borderRadius: 12, cursor: 'pointer', flexShrink: 0,
              background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(245,168,0,0.15)',
              border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(245,168,0,0.35)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <IonIcon icon={isDark ? sunnyOutline : moonOutline}
                style={{ fontSize: 18, color: isDark ? '#F5A800' : '#C4A35A' }} />
            </button>
            <button onClick={() => { logout(); history.push('/login'); }} style={{
              width: 40, height: 40, borderRadius: 12, cursor: 'pointer', flexShrink: 0,
              background: T.logoutBg, border: `1px solid ${T.logoutBorder}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <IonIcon icon={logOutOutline} style={{ fontSize: 18, color: T.text2 }} />
            </button>
          </div>
        </IonToolbar>
      </IonHeader>

      {/* ════════════════════ CONTENT ════════════════════ */}
      <IonContent style={{ '--background': T.contentBg }}>

        {/* ── Success banner ── */}
        {success && lastReceipt && (
          <div style={{
            position: 'sticky', top: 0, zIndex: 200,
            background: 'linear-gradient(135deg,#10B981,#059669)',
            padding: '12px 16px',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <IonIcon icon={checkmarkCircleOutline} style={{ fontSize: 24, color: '#fff', flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ color: '#fff', fontSize: 13, fontWeight: 800, margin: '0 0 1px' }}>
                #{lastReceipt.orderNumber} — {lastReceipt.mode === 'sur_place' ? 'Sur place' : 'À emporter'}
              </p>
              <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: 600, margin: 0 }}>
                Commande confirmée · impression envoyée
              </p>
            </div>
            <button
              onClick={() => printReceipt(lastReceipt.orderNumber, lastReceipt.mode, lastReceipt.cart, lastReceipt.total, lastReceipt.prepMinutes)}
              style={{
                flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5,
                background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.35)',
                borderRadius: 10, padding: '7px 12px', cursor: 'pointer',
              }}
            >
              <IonIcon icon={printOutline} style={{ fontSize: 17, color: '#fff' }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>Réimprimer</span>
            </button>
          </div>
        )}

        {/* ── Error ── */}
        {error && (
          <div style={{
            margin: '12px 16px',
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: 14, padding: '14px 16px',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <IonIcon icon={alertCircleOutline} style={{ fontSize: 22, color: '#EF4444', flexShrink: 0 }} />
            <p style={{ color: '#EF4444', fontSize: 13, fontWeight: 600, margin: 0 }}>{error}</p>
          </div>
        )}

        {/* ── Category tabs ── */}
        <div style={{
          overflowX: 'auto', whiteSpace: 'nowrap',
          padding: '12px 16px 4px',
          scrollbarWidth: 'none',
        }}>
          {[{ _id: 'all', name: { fr: 'Tout', ar: '' }, order: -1 }, ...categories].map(cat => {
            const isActive = activeCat === cat._id;
            return (
              <button
                key={cat._id}
                onClick={() => setActiveCat(cat._id)}
                style={{
                  display: 'inline-block',
                  padding: '9px 18px',
                  marginRight: 8,
                  borderRadius: 22,
                  border: isActive ? '1.5px solid #F5A800' : `1px solid ${T.cardBorder}`,
                  background: isActive ? '#F5A800' : T.cardBg,
                  color: isActive ? '#000' : T.text2,
                  fontWeight: isActive ? 800 : 600,
                  fontSize: 13,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  boxShadow: isActive ? '0 2px 10px rgba(245,168,0,0.35)' : 'none',
                }}
              >
                {cat.name.fr}
              </button>
            );
          })}
        </div>

        {/* ── Product count ── */}
        <div style={{ padding: '10px 16px 6px' }}>
          <span style={{ fontSize: 12, color: T.text3, fontWeight: 600 }}>
            {filtered.length} produit{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* ── Product grid ── */}
        <div style={{
          display: 'grid', gridTemplateColumns: gridCols,
          gap: 12, padding: '0 16px',
          paddingBottom: cartCount > 0 ? 100 : 24,
        }}>
          {filtered.map(product => (
            <ProductCard
              key={product._id}
              product={product}
              qtyInCart={cartCountForProduct(product._id)}
              onTap={handleProductTap}
              T={T}
            />
          ))}

          {filtered.length === 0 && !loading && (
            <div style={{
              gridColumn: '1 / -1',
              background: T.cardBg, border: `1px solid ${T.cardBorder}`,
              borderRadius: 16, padding: '40px 20px', textAlign: 'center',
              boxShadow: T.cardShadow,
            }}>
              <IonIcon icon={fastFoodOutline} style={{ fontSize: 48, color: T.text3 }} />
              <p style={{ fontSize: 15, color: T.text2, fontWeight: 600, margin: '12px 0 4px' }}>
                Aucun produit
              </p>
            </div>
          )}
        </div>
      </IonContent>

      {/* ════════════════════ CART BAR (fixed bottom) ════════════════════ */}
      {cartCount > 0 && !picker && !cartOpen && !checkoutOpen && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          padding: '12px 16px 20px',
          background: isDark ? '#1E293B' : '#fff',
          borderTop: `1px solid ${T.cardBorder}`,
          zIndex: 200,
          boxShadow: '0 -4px 24px rgba(0,0,0,0.15)',
        }}>
          <button
            onClick={() => setCartOpen(true)}
            style={{
              width: '100%', padding: '15px 20px',
              background: 'linear-gradient(135deg,#F5A800,#FF6B00)',
              border: 'none', borderRadius: 16, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              boxShadow: '0 4px 18px rgba(245,168,0,0.4)',
            }}
          >
            <div style={{
              background: 'rgba(0,0,0,0.2)', borderRadius: 10,
              width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: 14, fontWeight: 900, color: '#fff' }}>{cartCount}</span>
            </div>
            <span style={{ fontSize: 15, fontWeight: 800, color: '#000' }}>Voir le panier</span>
            <span style={{ fontSize: 16, fontWeight: 900, color: '#000' }}>{cartTotal.toFixed(2)} DT</span>
          </button>
        </div>
      )}

      {/* ════════════════════ OVERLAYS ════════════════════ */}
      {picker && (
        <SupplementPicker
          product={picker}
          T={T}
          isDark={isDark}
          onAdd={(qty, supps, notes) => addToCart(picker, qty, supps, notes)}
          onClose={() => setPicker(null)}
        />
      )}

      {cartOpen && !checkoutOpen && (
        <CartSheet
          cart={cart}
          onClose={() => setCartOpen(false)}
          onCheckout={() => { setCartOpen(false); setCheckoutOpen(true); }}
          onUpdateQty={updateQty}
          onRemove={removeFromCart}
          T={T}
        />
      )}

      {checkoutOpen && (
        <CheckoutForm
          cart={cart}
          onClose={() => setCheckoutOpen(false)}
          onSubmit={openPrepSheet}
          submitting={submitting}
          T={T}
        />
      )}

      <IonActionSheet
        isOpen={prepSheet.open}
        header="Temps de préparation"
        buttons={[
          { text: '15 minutes', icon: timerOutline, handler: () => handleConfirmWithTime(15) },
          { text: '30 minutes', icon: timerOutline, handler: () => handleConfirmWithTime(30) },
          { text: '45 minutes', icon: timerOutline, handler: () => handleConfirmWithTime(45) },
          { text: '1 heure',    icon: timerOutline, handler: () => handleConfirmWithTime(60) },
          { text: 'Annuler', role: 'cancel', handler: () => setPrepSheet(s => ({ ...s, open: false })) },
        ]}
        onDidDismiss={() => setPrepSheet(s => ({ ...s, open: false }))}
      />
    </IonPage>
  );
}
