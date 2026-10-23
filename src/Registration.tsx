import { useState } from "react";
import {
  createUserWithEmailAndPassword,
  updateProfile,
  sendEmailVerification,
} from "firebase/auth";
import { auth, db } from "./firebase";
import { doc, serverTimestamp, setDoc, Timestamp } from "firebase/firestore";

type RegistrationProps = {
  onRegistered: (email: string) => void;
  onLogin: () => void;
};

type LegalDocument = "terms" | "privacy" | null;

const TERMS_VERSION = "2026-10-23";

const termsSections = [
  ["1. Acceptance of Terms", "By creating an account, you confirm that you have read and agree to these Terms and Conditions and the Privacy Policy. If you do not agree, do not create an account or use features reserved for registered members."],
  ["2. Eligibility and Account Registration", "Provide accurate information and an email address you are authorised to access. Verify your email when required. You are responsible for keeping your password secure and for activity through your account. Do not impersonate another person or create accounts to deceive others. MingleMart is intended for adults aged 18 and over unless a use by a younger person is permitted by applicable law with appropriate parental or guardian involvement."],
  ["3. What MingleMart Does", "MingleMart is an online marketplace that helps people discover products and connect with buyers and sellers. Unless a service expressly says otherwise, MingleMart is a platform connecting members, not the seller of items advertised by members. Buyers and sellers are responsible for checking goods, agreeing on terms, and arranging payment, delivery, or collection."],
  ["4. Seller Responsibilities", "You must have the right to sell an item and provide accurate descriptions, prices, photographs, and location details to the best of your knowledge. Disclose important defects. Do not list illegal, stolen, counterfeit, fraudulent, or prohibited goods. Update listings when items are reserved, unavailable, or sold, and honour agreements subject to applicable law."],
  ["5. Buyer Responsibilities", "Communicate honestly and respectfully, check relevant item details before purchasing, avoid fraudulent payments or false claims, and use reasonable safety precautions. Do not make offers with the deliberate intention of deceiving sellers. Report suspicious listings or conduct."],
  ["6. Prohibited Activities", "Do not use MingleMart for fraud, theft, scams, unlawful sales, harassment, threats, spam, malicious links, unauthorised access, or disruption. Do not publish another person's private information without lawful authority. Do not manipulate reviews, likes, comments, or promotions, or evade restrictions using other accounts."],
  ["7. Transactions and Payments", "Unless MingleMart expressly provides a payment service for a transaction, buyers and sellers agree payment and delivery arrangements directly. MingleMart does not guarantee that a buyer will pay or a seller will deliver. Never rely on a screenshot alone as proof of payment. Applicable consumer rights and legal protections remain in force."],
  ["8. Featured Listings and Promotions", "Promotion prices, duration, and applicable conditions should be shown before payment. A paid promotion increases visibility but does not guarantee a sale. A promotion should only be activated after payment is confirmed through the designated payment process. Refunds and cancellations are handled under the published promotion policy and applicable law."],
  ["9. Messages, Comments, and Reviews", "Be respectful in messages, comments, and reviews. Do not threaten, harass, publish private information, post malicious falsehoods, or promote prohibited goods. Reviews must reflect genuine experiences. MingleMart may remove content or restrict accounts for violations."],
  ["10. Safety and Reports", "Use reasonable precautions when meeting other users or completing transactions. Where practical, meet in a safe public place, inspect goods before paying, and never share passwords or verification codes. MingleMart may review reports and restrict listings or accounts where reasonably necessary to protect members or comply with law."],
  ["11. Suspension and Termination", "MingleMart may restrict, suspend, or terminate accounts where there are reasonable grounds to believe these terms have been breached, fraud has occurred, users are at risk, or security is threatened. Where appropriate and legally permitted, the affected member may be told the reason and given a chance to respond or appeal."],
  ["12. Content and Intellectual Property", "You remain responsible for content you upload and must have the necessary rights to use it. You allow MingleMart to host, display, and distribute your listing content as reasonably necessary to operate and promote the marketplace. MingleMart branding and original platform materials may not be used in ways that infringe applicable rights."],
  ["13. Privacy", "MingleMart will handle personal information under its Privacy Policy and applicable Kenyan data-protection law. Do not post passwords, identity documents, or sensitive personal information in public listings or comments. The Privacy Policy should explain information collected, purposes, sharing, retention, and how applicable privacy rights can be exercised."],
  ["14. Availability and Liability", "MingleMart aims to provide a reliable service but cannot guarantee uninterrupted access or that every feature will always be available. The platform may be updated or maintained when necessary. Nothing in these terms excludes a right or protection that cannot lawfully be excluded."],
  ["15. Buyer-Seller Disputes", "Members should first try to resolve transaction disputes directly and respectfully. MingleMart may review reports or take action on accounts and listings but does not automatically guarantee refunds, delivery, product quality, or settlement of private disputes. This does not prevent users from exercising legal rights or contacting appropriate authorities."],
  ["16. Changes to Terms", "MingleMart may update these terms as services, security needs, or legal obligations change. Material changes will be communicated appropriately and renewed consent will be requested where required by law. The effective version and date will be updated when changes take effect."],
  ["17. Applicable Law", "These terms are intended to operate under the laws of Kenya, subject to applicable consumer-protection, data-protection, electronic-commerce, and other legal requirements."],
  ["18. Contact", "For questions or reports about these terms, contact gikonyolawrence61@gmail.com through MingleMart Kenya."]
];

const privacySections = [
  ["Information we collect", "When you register, MingleMart may process your name, email address, account identifier, email-verification status, listings, messages, comments, and information you choose to provide. Technical information may also be processed to operate and secure the service."],
  ["How information is used", "Information may be used to create and secure accounts, display listings, connect buyers and sellers, provide messaging and marketplace features, respond to reports, prevent abuse, and maintain the service."],
  ["Service providers", "MingleMart uses Firebase services for authentication and database functionality and may use third-party image hosting or payment providers as features are introduced. Those providers process information according to their applicable terms and privacy practices. Any payment integration should be described accurately before launch."],
  ["Sharing and public information", "Listing content and information you choose to make public may be visible to other users. Do not put passwords, verification codes, identity documents, or other sensitive information in public fields. MingleMart does not intend to sell personal information."],
  ["Security and retention", "Reasonable steps are intended to protect account and marketplace information, but no online service can guarantee absolute security. Information may be retained for as long as reasonably necessary for the purposes described, legal obligations, dispute handling, and security."],
  ["Your choices and rights", "Subject to applicable law, you may request access to, correction of, or deletion of personal information, and may exercise other rights available under Kenyan data-protection law. Some information may need to be retained where the law permits or requires it."],
  ["Children", "MingleMart is intended for adult account holders unless use by a younger person is permitted by applicable law with appropriate parental or guardian involvement."],
  ["Changes and contact", "This notice may be updated as MingleMart's services change. For privacy questions or requests, contact gikonyolawrence61@gmail.com. This notice must be kept consistent with the services and providers actually used by the live platform."]
];

export default function Registration({ onRegistered, onLogin }: RegistrationProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [legalDocument, setLegalDocument] = useState<LegalDocument>(null);

  const handleRegister = async () => {
    setError("");
    if (!name.trim()) return setError("Please enter your name.");
    if (!email.trim()) return setError("Please enter your email address.");
    if (!password) return setError("Please enter a password.");
    if (password.length < 6) return setError("Password must be at least 6 characters.");
    if (!accepted) return setError("Please read and accept the Terms and Conditions and Privacy Policy before creating your account.");

    setLoading(true);
    try {
      const result = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await updateProfile(result.user, { displayName: name.trim() });
      await sendEmailVerification(result.user);

      try {
        await setDoc(doc(db, "users", result.user.uid), {
          uid: result.user.uid,
          displayName: name.trim(),
          email: result.user.email ?? email.trim(),
          emailVerified: result.user.emailVerified,
          createdAt: Timestamp.fromDate(
            result.user.metadata.creationTime ? new Date(result.user.metadata.creationTime) : new Date()
          ),
          lastSeenAt: serverTimestamp(),
          termsAccepted: true,
          termsVersion: TERMS_VERSION,
          termsAcceptedAt: serverTimestamp(),
          privacyPolicyVersion: TERMS_VERSION,
          privacyPolicyAcceptedAt: serverTimestamp(),
        }, { merge: true });
      } catch (profileError) {
        // Do not leave a newly created Auth account stranded if profile rules need configuration.
        console.error("Could not save new user profile and consent record:", profileError);
      }

      onRegistered(email.trim());
    } catch (err: any) {
      if (err.code === "auth/email-already-in-use") {
        setError("This email is already registered. Please use another email or log in.");
      } else if (err.code === "auth/invalid-email") {
        setError("Please enter a valid email address.");
      } else if (err.code === "auth/weak-password") {
        setError("Password is too weak. Use at least 6 characters.");
      } else if (err.code === "auth/operation-not-allowed") {
        setError("Email/password authentication is not enabled in Firebase.");
      } else {
        setError(err.message || "Registration failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const panelStyle: React.CSSProperties = {
    width: "100%", maxWidth: "440px", background: "#fff", padding: "26px",
    borderRadius: "14px", boxShadow: "0 8px 28px rgba(16,36,58,0.12)", boxSizing: "border-box"
  };
  const inputStyle: React.CSSProperties = {
    display: "block", width: "100%", boxSizing: "border-box", padding: "12px",
    marginBottom: "14px", border: "1px solid #cbd5e1", borderRadius: "8px",
    fontSize: "16px", color: "#172033", background: "#fff"
  };
  const linkStyle: React.CSSProperties = {
    border: 0, padding: 0, background: "none", color: "#087443",
    textDecoration: "underline", fontWeight: 700, cursor: "pointer", fontSize: "inherit"
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", justifyContent: "center", alignItems: "center", background: "#f1f6f4", padding: "20px" }}>
      <div style={panelStyle}>
        <div style={{ textAlign: "center", marginBottom: "22px" }}>
          <div style={{ fontSize: "36px", fontWeight: 900, letterSpacing: "-1px", color: "#147a46" }}>MingleMart</div>
          <div style={{ color: "#526174", fontSize: "12px", letterSpacing: "1px" }}>CONNECT • BUY • SELL • MEET</div>
          <h2 style={{ color: "#10243a", marginBottom: "6px" }}>Create your account</h2>
          <p style={{ color: "#64748b", marginTop: 0 }}>Join MingleMart Kenya</p>
        </div>

        <label htmlFor="register-name" style={{ display: "block", fontWeight: 600, marginBottom: "6px", color: "#243247" }}>Full name</label>
        <input id="register-name" style={inputStyle} value={name} onChange={e => setName(e.target.value)} autoComplete="name" placeholder="Enter your name" />

        <label htmlFor="register-email" style={{ display: "block", fontWeight: 600, marginBottom: "6px", color: "#243247" }}>Email address</label>
        <input id="register-email" style={inputStyle} type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" placeholder="you@example.com" />

        <label htmlFor="register-password" style={{ display: "block", fontWeight: 600, marginBottom: "6px", color: "#243247" }}>Password</label>
        <input id="register-password" style={inputStyle} type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" placeholder="At least 6 characters" />

        <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", padding: "13px", border: "1px solid #d5e5dc", borderRadius: "9px", background: "#f7fbf8", margin: "6px 0 16px" }}>
          <input id="accept-terms" type="checkbox" checked={accepted} onChange={e => { setAccepted(e.target.checked); if (e.target.checked) setError(""); }} style={{ width: "20px", height: "20px", marginTop: "2px", flexShrink: 0, accentColor: "#16803c" }} />
          <label htmlFor="accept-terms" style={{ fontSize: "14px", lineHeight: 1.6, color: "#243247" }}>
            I have read and agree to the{" "}
            <button type="button" style={linkStyle} onClick={() => setLegalDocument("terms")}>Terms and Conditions</button>
            {" "}and{" "}
            <button type="button" style={linkStyle} onClick={() => setLegalDocument("privacy")}>Privacy Policy</button>.
          </label>
        </div>

        {error && <p role="alert" style={{ color: "#b91c1c", background: "#fff1f2", border: "1px solid #fecdd3", padding: "10px", borderRadius: "8px", fontSize: "14px" }}>{error}</p>}

        <button type="button" onClick={handleRegister} disabled={loading || !accepted} style={{ width: "100%", padding: "13px", background: loading || !accepted ? "#94a3b8" : "#16803c", color: "#fff", border: 0, borderRadius: "8px", fontSize: "16px", fontWeight: 700, cursor: loading || !accepted ? "not-allowed" : "pointer" }}>
          {loading ? "Creating account..." : "Create Account"}
        </button>
        <p style={{ textAlign: "center", color: "#526174", fontSize: "14px", marginTop: "18px" }}>
          Already have an account?{" "}
          <button type="button" onClick={onLogin} style={linkStyle}>Log in</button>
        </p>
        <p style={{ color: "#64748b", fontSize: "12px", textAlign: "center", lineHeight: 1.5 }}>
          You must accept both documents before an account can be created.
        </p>
      </div>

      {legalDocument && (
        <div role="presentation" onClick={() => setLegalDocument(null)} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(10,20,30,0.72)", display: "flex", alignItems: "center", justifyContent: "center", padding: "14px" }}>
          <section role="dialog" aria-modal="true" aria-labelledby="legal-title" onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: "700px", maxHeight: "88vh", overflowY: "auto", background: "#fff", borderRadius: "14px", padding: "22px", boxSizing: "border-box", color: "#243247" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", position: "sticky", top: -22, background: "#fff", padding: "8px 0", borderBottom: "1px solid #e2e8f0" }}>
              <h2 id="legal-title" style={{ margin: 0, color: "#10243a", fontSize: "21px" }}>{legalDocument === "terms" ? "MingleMart Terms and Conditions" : "MingleMart Privacy Policy"}</h2>
              <button type="button" onClick={() => setLegalDocument(null)} aria-label="Close document" style={{ border: 0, borderRadius: "8px", padding: "8px 12px", background: "#e2e8f0", cursor: "pointer", fontWeight: 700 }}>Close ✕</button>
            </div>
            <p style={{ color: "#64748b", fontSize: "13px" }}>MingleMart Kenya · Effective 23 October 2026 · Contact: gikonyolawrence61@gmail.com</p>
            {(legalDocument === "terms" ? termsSections : privacySections).map(([heading, body]) => (
              <div key={heading} style={{ margin: "18px 0" }}>
                <h3 style={{ color: "#147a46", fontSize: "16px", marginBottom: "6px" }}>{heading}</h3>
                <p style={{ lineHeight: 1.65, marginTop: 0, whiteSpace: "pre-wrap" }}>{body}</p>
              </div>
            ))}
            <button type="button" onClick={() => { setLegalDocument(null); if (legalDocument === "terms") setAccepted(true); }} style={{ width: "100%", padding: "12px", border: 0, borderRadius: "8px", background: "#16803c", color: "#fff", fontWeight: 700, fontSize: "15px", cursor: "pointer" }}>
              {legalDocument === "terms" ? "I have read the Terms" : "Close Privacy Policy"}
            </button>
            {legalDocument === "terms" && <p style={{ fontSize: "12px", color: "#64748b", textAlign: "center" }}>Reading this document does not replace checking the acceptance box.</p>}
          </section>
        </div>
      )}
    </div>
  );
}
