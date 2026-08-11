-- AlterTable
ALTER TABLE "User" DROP COLUMN IF EXISTS "isVerified";

-- AlterTable
ALTER TABLE "Enquiry" DROP COLUMN IF EXISTS "whatsappSent";

-- DropTable
DROP TABLE IF EXISTS "OtpRequest";
