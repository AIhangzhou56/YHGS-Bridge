use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer, Mint, MintTo, Burn};

declare_id!("BR1dg3Prog1111111111111111111111111111111111");

#[program]
pub mod bridge {
    use super::*;

    pub fn lock(
        ctx: Context<Lock>, 
        amount: u64, 
        target_chain: [u8; 32], 
        target_addr: Vec<u8>
    ) -> Result<()> {
        require!(amount > 0, BridgeError::InvalidAmount);
        require!(target_addr.len() <= 64, BridgeError::InvalidTargetAddress);

        // Transfer tokens to bridge vault
        token::transfer(ctx.accounts.into_transfer_context(), amount)?;
        
        let bridge_state = &mut ctx.accounts.bridge_state;
        bridge_state.nonce += 1;

        emit!(Locked {
            source: *ctx.accounts.user.key,
            token: ctx.accounts.token_mint.key(),
            amount,
            target_chain,
            target_addr,
            nonce: bridge_state.nonce,
            slot: ctx.accounts.clock.slot,
        });
        
        Ok(())
    }

    pub fn release(
        ctx: Context<Release>, 
        amount: u64, 
        source_tx: [u8; 32]
    ) -> Result<()> {
        let bridge_state = &mut ctx.accounts.bridge_state;
        
        require!(
            !bridge_state.processed.contains(&source_tx), 
            BridgeError::AlreadyProcessed
        );
        
        bridge_state.processed.push(source_tx);
        
        // Transfer from vault to user
        let seeds = &[b"vault", &[ctx.bumps.vault]];
        let signer = &[&seeds[..]];
        
        token::transfer(
            ctx.accounts.into_transfer_context().with_signer(signer), 
            amount
        )?;
        
        emit!(Released {
            recipient: *ctx.accounts.user.key,
            amount,
            source_tx,
        });
        
        Ok(())
    }

    pub fn mint_wrapped(
        ctx: Context<MintWrapped>,
        amount: u64,
        source_tx: [u8; 32],
        source_chain: [u8; 32]
    ) -> Result<()> {
        let bridge_state = &mut ctx.accounts.bridge_state;
        
        require!(
            !bridge_state.processed.contains(&source_tx),
            BridgeError::AlreadyProcessed
        );
        
        bridge_state.processed.push(source_tx);
        
        // Mint wrapped tokens
        let seeds = &[b"wrapped_mint", source_chain.as_ref(), &[ctx.bumps.wrapped_mint]];
        let signer = &[&seeds[..]];
        
        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.wrapped_mint.to_account_info(),
                    to: ctx.accounts.user_token_account.to_account_info(),
                    authority: ctx.accounts.wrapped_mint.to_account_info(),
                },
                signer
            ),
            amount
        )?;
        
        emit!(WrappedMinted {
            recipient: *ctx.accounts.user.key,
            wrapped_mint: ctx.accounts.wrapped_mint.key(),
            amount,
            source_tx,
            source_chain,
        });
        
        Ok(())
    }

    pub fn burn_wrapped(
        ctx: Context<BurnWrapped>,
        amount: u64,
        target_chain: [u8; 32],
        target_addr: Vec<u8>
    ) -> Result<()> {
        require!(amount > 0, BridgeError::InvalidAmount);
        
        // Burn wrapped tokens
        token::burn(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Burn {
                    mint: ctx.accounts.wrapped_mint.to_account_info(),
                    from: ctx.accounts.user_token_account.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                }
            ),
            amount
        )?;
        
        let bridge_state = &mut ctx.accounts.bridge_state;
        bridge_state.nonce += 1;
        
        emit!(WrappedBurned {
            source: *ctx.accounts.user.key,
            wrapped_mint: ctx.accounts.wrapped_mint.key(),
            amount,
            target_chain,
            target_addr,
            nonce: bridge_state.nonce,
        });
        
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Lock<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    
    #[account(
        mut,
        constraint = user_token_account.owner == user.key(),
        constraint = user_token_account.mint == token_mint.key()
    )]
    pub user_token_account: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        seeds = [b"vault", token_mint.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, TokenAccount>,
    
    pub token_mint: Account<'info, Mint>,
    
    #[account(mut, seeds = [b"bridge_state"], bump)]
    pub bridge_state: Account<'info, BridgeState>,
    
    pub clock: Sysvar<'info, Clock>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct Release<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        seeds = [b"vault"],
        bump
    )]
    pub vault: Account<'info, TokenAccount>,
    
    #[account(mut, seeds = [b"bridge_state"], bump)]
    pub bridge_state: Account<'info, BridgeState>,
    
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct MintWrapped<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        seeds = [b"wrapped_mint", source_chain.as_ref()],
        bump
    )]
    pub wrapped_mint: Account<'info, Mint>,
    
    /// CHECK: Used for seeding only
    pub source_chain: AccountInfo<'info>,
    
    #[account(mut, seeds = [b"bridge_state"], bump)]
    pub bridge_state: Account<'info, BridgeState>,
    
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct BurnWrapped<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub wrapped_mint: Account<'info, Mint>,
    
    #[account(mut, seeds = [b"bridge_state"], bump)]
    pub bridge_state: Account<'info, BridgeState>,
    
    pub token_program: Program<'info, Token>,
}

#[account]
pub struct BridgeState {
    pub nonce: u64,
    pub processed: Vec<[u8; 32]>,
}

impl<'info> Lock<'info> {
    fn into_transfer_context(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        CpiContext::new(
            self.token_program.to_account_info(),
            Transfer {
                from: self.user_token_account.to_account_info(),
                to: self.vault.to_account_info(),
                authority: self.user.to_account_info(),
            }
        )
    }
}

impl<'info> Release<'info> {
    fn into_transfer_context(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        CpiContext::new(
            self.token_program.to_account_info(),
            Transfer {
                from: self.vault.to_account_info(),
                to: self.user_token_account.to_account_info(),
                authority: self.vault.to_account_info(),
            }
        )
    }
}

#[event]
pub struct Locked {
    pub source: Pubkey,
    pub token: Pubkey,
    pub amount: u64,
    pub target_chain: [u8; 32],
    pub target_addr: Vec<u8>,
    pub nonce: u64,
    pub slot: u64,
}

#[event]
pub struct Released {
    pub recipient: Pubkey,
    pub amount: u64,
    pub source_tx: [u8; 32],
}

#[event]
pub struct WrappedMinted {
    pub recipient: Pubkey,
    pub wrapped_mint: Pubkey,
    pub amount: u64,
    pub source_tx: [u8; 32],
    pub source_chain: [u8; 32],
}

#[event]
pub struct WrappedBurned {
    pub source: Pubkey,
    pub wrapped_mint: Pubkey,
    pub amount: u64,
    pub target_chain: [u8; 32],
    pub target_addr: Vec<u8>,
    pub nonce: u64,
}

#[error_code]
pub enum BridgeError {
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("Invalid target address")]
    InvalidTargetAddress,
    #[msg("Transaction already processed")]
    AlreadyProcessed,
}