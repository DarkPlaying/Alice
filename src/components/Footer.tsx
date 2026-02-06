import { motion } from 'framer-motion';

export const Footer = () => {
    return (
        <motion.footer
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1, delay: 0.5 }}
            className="py-8 bg-black border-t border-white/10 text-center text-gray-600 font-mono text-xs"
        >
            <p>BORDERLAND SYSTEM v.2.0 // ALL RIGHTS RESERVED</p>
        </motion.footer>
    );
};
