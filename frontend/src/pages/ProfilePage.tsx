import { useState, useRef } from 'react';
import {
    Container,
    Typography,
    Box,
    Card,
    CardContent,
    Avatar,
    Button,
    Stack,
    Divider,
    Alert,
    IconButton,
} from '@mui/material';
import {
    PhotoCamera as PhotoCameraIcon,
    Delete as DeleteIcon,
    Person as PersonIcon,
    Email as EmailIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';

export default function ProfilePage() {
    const { user, profilePic, updateProfilePic } = useAuth();
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            setError('Please upload an image file.');
            return;
        }

        // Validate file size (limit to 2MB)
        if (file.size > 2 * 1024 * 1024) {
            setError('Image size must be less than 2MB.');
            return;
        }

        setError(null);
        const reader = new FileReader();
        reader.onloadend = () => {
            if (typeof reader.result === 'string') {
                updateProfilePic(reader.result);
            }
        };
        reader.readAsDataURL(file);
    };

    const handleRemovePic = () => {
        updateProfilePic(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    if (!user) {
        return (
            <Container maxWidth="md" sx={{ mt: 4 }}>
                <Alert severity="warning">You must be logged in to view this page.</Alert>
            </Container>
        );
    }

    return (
        <Container maxWidth="sm" sx={{ mt: 4, mb: 4 }}>
            <Typography variant="h5" fontWeight={700} sx={{ mb: 3 }}>
                Profile
            </Typography>

            <Card
                sx={{
                    background: 'rgba(30, 41, 59, 0.5)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    position: 'relative',
                    overflow: 'visible',
                    mt: 6,
                }}
            >
                <CardContent sx={{ pt: 0, px: 4, pb: 4 }}>
                    <Box
                        sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            textAlign: 'center',
                            mt: -6,
                        }}
                    >
                        <Box sx={{ position: 'relative', mb: 2 }}>
                            <Avatar
                                src={profilePic || undefined}
                                sx={{
                                    width: 110,
                                    height: 110,
                                    fontSize: '3rem',
                                    bgcolor: 'primary.main',
                                    border: '4px solid #0f172a',
                                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
                                }}
                            >
                                {!profilePic && (user.name?.charAt(0) || 'U')}
                            </Avatar>
                            <IconButton
                                color="primary"
                                aria-label="upload picture"
                                component="label"
                                sx={{
                                    position: 'absolute',
                                    bottom: 0,
                                    right: 0,
                                    backgroundColor: '#0f172a',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    '&:hover': {
                                        backgroundColor: '#1e293b',
                                    },
                                }}
                            >
                                <input
                                    hidden
                                    accept="image/*"
                                    type="file"
                                    onChange={handleFileChange}
                                    ref={fileInputRef}
                                />
                                <PhotoCameraIcon fontSize="small" sx={{ color: '#fff' }} />
                            </IconButton>
                        </Box>

                        <Typography variant="h6" fontWeight={700} sx={{ color: '#fff' }}>
                            {user.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            Account User
                        </Typography>

                        {profilePic && (
                            <Button
                                size="small"
                                variant="outlined"
                                color="error"
                                startIcon={<DeleteIcon />}
                                onClick={handleRemovePic}
                                sx={{ mb: 2 }}
                            >
                                Remove Picture
                            </Button>
                        )}
                    </Box>

                    {error && (
                        <Alert severity="error" sx={{ mt: 2, mb: 2 }}>
                            {error}
                        </Alert>
                    )}

                    <Divider sx={{ my: 3, borderColor: 'rgba(255,255,255,0.1)' }} />

                    <Stack spacing={2.5}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <PersonIcon sx={{ color: 'text.secondary' }} />
                            <Box>
                                <Typography variant="caption" color="text.secondary" display="block">
                                    Full Name
                                </Typography>
                                <Typography variant="body1" sx={{ color: '#fff' }}>
                                    {user.name}
                                </Typography>
                            </Box>
                        </Box>

                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <EmailIcon sx={{ color: 'text.secondary' }} />
                            <Box>
                                <Typography variant="caption" color="text.secondary" display="block">
                                    Email Address
                                </Typography>
                                <Typography variant="body1" sx={{ color: '#fff' }}>
                                    {user.email}
                                </Typography>
                            </Box>
                        </Box>
                    </Stack>
                </CardContent>
            </Card>
        </Container>
    );
}
