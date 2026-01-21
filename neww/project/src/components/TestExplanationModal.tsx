import { X, Activity } from 'lucide-react';

interface TestExplanationModalProps {
  testName: string;
  onClose: () => void;
}

const testExplanations: Record<string, string> = {
  'Vidal Test': 'A blood test that helps in detecting typhoid fever infection by checking for antibodies against Salmonella typhi bacteria.',
  'CBC': 'Complete Blood Count - measures different components of your blood including red cells, white cells, and platelets. Helps detect anemia, infections, and other conditions.',
  'CRP': 'C-Reactive Protein - a blood test that measures inflammation in the body. High levels may indicate infection, injury, or chronic disease.',
  'SGPT': 'Serum Glutamic Pyruvic Transaminase (also called ALT) - a liver enzyme test that indicates liver health. Elevated levels may suggest liver damage or disease.',
  'SGOT': 'Serum Glutamic Oxaloacetic Transaminase (also called AST) - another liver enzyme test that helps assess liver function.',
  'Blood Sugar': 'Measures the amount of glucose in your blood. Helps diagnose and monitor diabetes.',
  'Hemoglobin': 'Measures the protein in red blood cells that carries oxygen. Low levels indicate anemia.',
  'TSH': 'Thyroid Stimulating Hormone - checks how well your thyroid gland is working. Helps diagnose thyroid disorders.',
  'Cholesterol': 'Measures fats in your blood including LDL (bad), HDL (good), and triglycerides. Important for heart health.',
  'Creatinine': 'A waste product filtered by kidneys. High levels may indicate kidney problems.',
  'Uric Acid': 'Measures uric acid in blood. High levels can cause gout and kidney stones.',
  'Vitamin D': 'Measures vitamin D levels in blood. Important for bone health and immune function.',
  'Vitamin B12': 'Measures B12 levels. Low levels can cause anemia and nervous system problems.',
  'HbA1c': 'Shows average blood sugar levels over the past 2-3 months. Used to diagnose and monitor diabetes.',
  'ESR': 'Erythrocyte Sedimentation Rate - measures inflammation in the body.',
  'Lipid Profile': 'Comprehensive test measuring cholesterol and triglycerides to assess heart disease risk.',
};

export default function TestExplanationModal({ testName, onClose }: TestExplanationModalProps) {
  const explanation = testExplanations[testName] ||
    `${testName} is a medical test used to evaluate specific health conditions. Please consult your doctor for detailed information about this test.`;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 animate-in fade-in duration-200">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <Activity className="w-6 h-6 text-blue-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">{testName}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="bg-blue-50 rounded-xl p-4 mb-6">
          <p className="text-gray-700 leading-relaxed">{explanation}</p>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
          <p className="text-sm text-yellow-800">
            <strong>Note:</strong> This is a simplified explanation. Always consult with your healthcare provider for proper interpretation of your test results.
          </p>
        </div>

        <button
          onClick={onClose}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition duration-200"
        >
          Close
        </button>
      </div>
    </div>
  );
}
