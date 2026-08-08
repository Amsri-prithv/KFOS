import React from 'react';
import { Package, Droplet, ShieldCheck, Sparkles, CheckCircle2 } from 'lucide-react';
import { PRICING_MATRIX, QualityGrade } from '../types/kfos';

export const ProductsCatalog: React.FC = () => {
  const grades: { quality: QualityGrade; desc: string; color: string; badge: string }[] = [
    {
      quality: 'Eco',
      desc: 'Cost-effective high-volume fragrance for commercial venues, hotels, and public places.',
      color: 'border-emerald-500/30 bg-emerald-950/10 text-emerald-400',
      badge: 'High-Volume Commercial',
    },
    {
      quality: 'Standard',
      desc: 'Balanced essential oil blend offering long-lasting fragrance performance for retail & offices.',
      color: 'border-blue-500/30 bg-blue-950/10 text-blue-400',
      badge: 'Best Seller',
    },
    {
      quality: 'Premium',
      desc: 'Ultra-concentrated luxury essential formulation for high-end hospitality & luxury homes.',
      color: 'border-amber-500/30 bg-amber-950/10 text-amber-400',
      badge: 'Luxury Grade',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-neutral-900 p-6 rounded-2xl border border-neutral-800">
        <div>
          <h2 className="text-xl font-bold text-neutral-100 flex items-center gap-2">
            <Package className="w-5 h-5 text-amber-400" />
            Product Catalog & Pricing Matrix
          </h2>
          <p className="text-sm text-neutral-400 mt-1">
            Official KFOS 5L liquid fragrance pricing, wholesale margins, and variant specifications.
          </p>
        </div>
      </div>

      {/* Product Quality Grades Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {grades.map(({ quality, desc, color, badge }) => {
          const pricing = PRICING_MATRIX[quality];
          return (
            <div
              key={quality}
              className={`p-6 rounded-2xl bg-neutral-900 border ${color} shadow-lg flex flex-col justify-between space-y-4`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded-full bg-neutral-800 border border-neutral-700">
                    {badge}
                  </span>
                  <Droplet className="w-5 h-5" />
                </div>
                <h3 className="text-2xl font-black text-neutral-100 mt-2">{quality} Grade</h3>
                <p className="text-xs text-neutral-400 mt-2 leading-relaxed">{desc}</p>
              </div>

              <div className="space-y-2 pt-4 border-t border-neutral-800 font-mono">
                <div className="flex justify-between text-xs">
                  <span className="text-neutral-400">Buying Price (5L Can):</span>
                  <span className="text-neutral-200 font-semibold">₹{pricing.buyPrice}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-neutral-400">Selling Price (5L Can):</span>
                  <span className="text-amber-400 font-bold">₹{pricing.salePrice}</span>
                </div>
                <div className="flex justify-between text-xs pt-1 border-t border-neutral-800/60">
                  <span className="text-emerald-400 font-medium">Base Margin / Can:</span>
                  <span className="text-emerald-400 font-bold">₹{pricing.baseProfit}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Product Variants Table */}
      <div className="bg-neutral-900 rounded-2xl border border-neutral-800 p-6 space-y-4">
        <h3 className="text-lg font-bold text-neutral-100 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-indigo-400" />
          Product Variant Specifications & Liquid Equivalents
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-neutral-300 font-mono">
            <thead className="text-xs text-neutral-400 uppercase bg-neutral-950 border-b border-neutral-800">
              <tr>
                <th className="px-4 py-3">Variant Name</th>
                <th className="px-4 py-3">Packaging Unit</th>
                <th className="px-4 py-3">5L Can Equivalent</th>
                <th className="px-4 py-3">Sample Eligibility</th>
                <th className="px-4 py-3">Default Quality</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              <tr className="hover:bg-neutral-800/30">
                <td className="px-4 py-3 font-bold text-neutral-100">Room Freshener (5L Bulk)</td>
                <td className="px-4 py-3">5 Litre HDPE Can</td>
                <td className="px-4 py-3 text-amber-400">1.0 Can</td>
                <td className="px-4 py-3 text-neutral-400">Standard Sales Unit</td>
                <td className="px-4 py-3 text-emerald-400">Eco / Standard / Premium</td>
              </tr>
              <tr className="hover:bg-neutral-800/30">
                <td className="px-4 py-3 font-bold text-neutral-100">Bathroom Freshener (5L Bulk)</td>
                <td className="px-4 py-3">5 Litre HDPE Can</td>
                <td className="px-4 py-3 text-amber-400">1.0 Can</td>
                <td className="px-4 py-3 text-neutral-400">Standard Sales Unit</td>
                <td className="px-4 py-3 text-emerald-400">Eco / Standard / Premium</td>
              </tr>
              <tr className="hover:bg-neutral-800/30">
                <td className="px-4 py-3 font-bold text-neutral-100">200ml Sample Spray</td>
                <td className="px-4 py-3">200ml Bottle</td>
                <td className="px-4 py-3 text-neutral-400">0.04 Can</td>
                <td className="px-4 py-3 text-emerald-400">Max 2 Free (Premium)</td>
                <td className="px-4 py-3 text-amber-400">Premium Only</td>
              </tr>
              <tr className="hover:bg-neutral-800/30">
                <td className="px-4 py-3 font-bold text-neutral-100">500ml Trial Spray</td>
                <td className="px-4 py-3">500ml Bottle</td>
                <td className="px-4 py-3 text-neutral-400">0.10 Can</td>
                <td className="px-4 py-3 text-indigo-400">Paid Trial (₹300)</td>
                <td className="px-4 py-3 text-amber-400">Premium Only</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
