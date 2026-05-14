import { useNavigate } from "react-router-dom"
import { RedeemCodeModal } from "@/components/modals/RedeemCodeModal"

const Redeem = () => {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <RedeemCodeModal
        isOpen={true}
        onClose={() => navigate("/dashboard")}
      />
    </div>
  )
}

export default Redeem
