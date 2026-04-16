import { motion } from "@motionone/react";
import { Link, useParams } from "react-router-dom";
import { categoryInfo, getWorkflowsByCategory, WorkflowCategory, Platform } from "../data/workflowData";
import { 
  ArrowLeft,
  ArrowRight, 
  GitBranch, 
  RotateCw, 
  Zap, 
  Settings, 
  Brain, 
  Database, 
  Box,
  CheckCircle2,
  Clock,
  TrendingUp,
  ShoppingCart
} from "lucide-react";
import { useCart } from "../store/CartContext";
import { toast } from "sonner";

const iconMap: Record<string, any> = {
  ArrowRight,
  GitBranch,
  RotateCw,
  Zap,
  Settings,
  Brain,
  Database,
  Box
};

const complexityColors = {
  beginner: "text-green-400 bg-green-400/10 border-green-400/30",
  intermediate: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30",
  advanced: "text-red-400 bg-red-400/10 border-red-400/30"
};

export function CategoryDetail() {
  const { platform, category } = useParams<{ platform: string; category: string }>();
  const { addToCart } = useCart();
  
  const categoryData = categoryInfo[category as WorkflowCategory];
  const [workflows, setWorkflows] = React.useState<any[]>([]);
  const [isEmpty, setIsEmpty] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      const list = await fetchWorkflowsByCategory(platform as Platform, category as WorkflowCategory);
      if (mounted) {
        setWorkflows(list);
        setIsEmpty(Array.isArray(list) && list.length === 0);
      }
    })();
    return () => { mounted = false };
  }, [platform, category]);

  if (!categoryData) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Category not found</h1>
          <Link to="/" className="text-cyan-400 hover:text-cyan-300">
            Return to home
          </Link>
        </div>
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="min-h-screen bg-zinc-950 pt-24 pb-20">
        <ComingSoon message={"Premium workflows for this category are coming soon. Check back shortly."} />
      </div>
    );
  }

  const IconComponent = iconMap[categoryData.icon] || ArrowRight;
  const isPurple = platform === 'make';
  const gradientClass = isPurple 
    ? "from-purple-400 to-pink-500" 
    : "from-cyan-400 to-blue-500";
  const accentClass = isPurple ? "purple" : "cyan";

  const handleAddToCart = (workflow: any) => {
    addToCart({
      id: workflow.id,
      title: workflow.title,
      price: workflow.price,
      image: workflow.image
    });
    toast.success(`Added "${workflow.title}" to cart`);
  };

  return (
    <div className="min-h-screen bg-zinc-950 pt-24 pb-20">
      {/* Back Button */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-8">
        <Link
          to={`/${platform}`}
          className="inline-flex items-center gap-2 text-zinc-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to {platform === 'make' ? 'Make.com' : 'n8n'} workflows
        </Link>
      </div>

      {/* Category Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center"
        >
          <div className={`inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br ${isPurple ? 'from-purple-500/20 to-pink-500/20' : 'from-cyan-500/20 to-blue-500/20'} mb-6`}>
            <IconComponent className={`w-10 h-10 ${isPurple ? 'text-purple-400' : 'text-cyan-400'}`} />
          </div>

          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            {categoryData.title}
          </h1>
          
          <p className="text-xl text-zinc-400 max-w-3xl mx-auto mb-8">
            {categoryData.description}
          </p>
        </motion.div>

        {/* Explanation Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-12 p-8 rounded-2xl bg-zinc-900/50 border border-zinc-800/50"
        >
          <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${isPurple ? 'from-purple-500/20 to-pink-500/20' : 'from-cyan-500/20 to-blue-500/20'} flex items-center justify-center`}>
              <TrendingUp className={`w-5 h-5 ${isPurple ? 'text-purple-400' : 'text-cyan-400'}`} />
            </div>
            What is {categoryData.title}?
          </h2>
          <p className="text-zinc-300 text-lg mb-8 leading-relaxed">
            {categoryData.explanation}
          </p>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Benefits */}
            <div>
              <h3 className={`text-lg font-semibold mb-4 ${isPurple ? 'text-purple-400' : 'text-cyan-400'}`}>
                Key Benefits
              </h3>
              <ul className="space-y-3">
                {categoryData.benefits.map((benefit, index) => (
                  <li key={index} className="flex items-start gap-3 text-zinc-300">
                    <CheckCircle2 className={`w-5 h-5 ${isPurple ? 'text-purple-400' : 'text-cyan-400'} flex-shrink-0 mt-0.5`} />
                    <span>{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Use Cases */}
            <div>
              <h3 className={`text-lg font-semibold mb-4 ${isPurple ? 'text-pink-400' : 'text-blue-400'}`}>
                Common Use Cases
              </h3>
              <ul className="space-y-3">
                {categoryData.useCases.map((useCase, index) => (
                  <li key={index} className="flex items-start gap-3 text-zinc-300">
                    <div className={`w-5 h-5 rounded-full ${isPurple ? 'bg-pink-500/20' : 'bg-blue-500/20'} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                      <div className={`w-2 h-2 rounded-full ${isPurple ? 'bg-pink-400' : 'bg-blue-400'}`}></div>
                    </div>
                    <span>{useCase}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Products Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold text-white mb-2">Available Workflows</h2>
              <p className="text-zinc-400">{workflows.length} premium workflow{workflows.length !== 1 ? 's' : ''} available</p>
            </div>
          </div>

          {workflows.length === 0 ? (
            <div className="text-center py-16 px-4 rounded-2xl bg-zinc-900/30 border border-zinc-800/30">
              <p className="text-zinc-500 text-lg">No workflows available in this category yet.</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-8">
              {workflows.map((workflow, index) => (
                <motion.div
                  key={workflow.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.5 + index * 0.1 }}
                  className="group rounded-2xl bg-zinc-900/50 border border-zinc-800/50 overflow-hidden hover:border-zinc-700 transition-all"
                >
                  {/* Image */}
                  <div className="relative h-56 overflow-hidden bg-zinc-800">
                    <img 
                      src={workflow.image} 
                      alt={workflow.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-zinc-900/50 to-transparent"></div>
                    
                    {/* Badges */}
                    <div className="absolute top-4 left-4 flex gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${complexityColors[workflow.complexity]}`}>
                        {workflow.complexity}
                      </span>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="text-xl font-bold text-white group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:bg-clip-text group-hover:${gradientClass} transition-all">
                        {workflow.title}
                      </h3>
                      <div className="text-right flex-shrink-0 ml-4">
                        <div className={`text-2xl font-bold bg-gradient-to-r ${gradientClass} bg-clip-text text-transparent`}>
                          ${workflow.price}
                        </div>
                      </div>
                    </div>

                    <p className="text-zinc-400 mb-4 line-clamp-2">
                      {workflow.description}
                    </p>

                    {/* Meta Info */}
                    <div className="flex items-center gap-4 mb-4 text-sm text-zinc-500">
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        <span>{workflow.estimatedTime}</span>
                      </div>
                    </div>

                    {/* Features */}
                    <div className="mb-6">
                      <h4 className="text-sm font-semibold text-zinc-300 mb-2">Includes:</h4>
                      <ul className="space-y-1.5">
                        {workflow.features.slice(0, 3).map((feature, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm text-zinc-400">
                            <CheckCircle2 className={`w-4 h-4 ${isPurple ? 'text-purple-400' : 'text-cyan-400'} flex-shrink-0 mt-0.5`} />
                            <span>{feature}</span>
                          </li>
                        ))}
                        {workflow.features.length > 3 && (
                          <li className="text-sm text-zinc-500 ml-6">
                            +{workflow.features.length - 3} more features
                          </li>
                        )}
                      </ul>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleAddToCart(workflow)}
                        className={`flex-1 py-3 px-4 rounded-xl bg-gradient-to-r ${isPurple ? 'from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600' : 'from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600'} text-white font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2`}
                      >
                        <ShoppingCart className="w-5 h-5" />
                        Add to Cart
                      </button>
                      <Link
                        to={`/workflow/${platform}/${workflow.id}`}
                        className="px-4 py-3 rounded-xl border border-zinc-700 text-zinc-300 hover:border-zinc-600 hover:bg-zinc-800/50 transition-all flex items-center justify-center"
                      >
                        <ArrowRight className="w-5 h-5" />
                      </Link>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
