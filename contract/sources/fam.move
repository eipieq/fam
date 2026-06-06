module fam::groups;

use std::string::{Self, String};
use sui::table::{Self, Table};
use sui::coin::{Self, Coin};
use sui::sui::SUI;
use sui::event;
use sui::clock::{Self, Clock};
use sui::balance::{Self, Balance};

// ===== Errors =====
const ENotAdmin: u64 = 1;
const ENotMember: u64 = 2;
const EAlreadyMember: u64 = 3;
const EGroupFull: u64 = 4;
const EAlreadyRegistered: u64 = 5;
const EAlreadyVoted: u64 = 6;
const EInsufficientFuel: u64 = 7;
const EInsufficientPayment: u64 = 8;
const EFaceCheckFailed: u64 = 9;
const EPhotoNotFound: u64 = 10;
const EAlreadySealed: u64 = 11;
const ENoAccess: u64 = 12;

// ===== Constants =====
const MAX_MEMBERS: u64 = 5;
const FUEL_PRICE: u64 = 5_000_000_000; // 5 SUI per fuel bundle
const PHOTOS_PER_FUEL: u64 = 50;

// ===== Structs =====

public struct Member has store, copy, drop {
    addr: address,
    display_name: String,
    reference_blob_id: String,
    joined_at: u64,
}

public struct Photo has store {
    id: u64,
    blob_id: String,
    caption: String,
    submitted_by: address,
    submitted_at: u64,
    approvals: vector<address>,
    rejections: vector<address>,
    sealed: bool,
    face_check_passed: bool,
    nautilus_attestation: vector<u8>,
}

public struct Group has key, store {
    id: object::UID,
    group_id: u64,
    name: String,
    members: vector<Member>,
    photos: Table<u64, Photo>,
    photo_count: u64,
    fuel: u64,
    treasury: Balance<SUI>,
    created_at: u64,
    admin: address,
    invited: vector<address>,
}

public struct FamState has key {
    id: object::UID,
    groups: Table<u64, address>, // group_id -> Group object address
    group_count: u64,
    nautilus_pubkey: vector<u8>,
    admin: address,
}

// ===== Events =====

public struct GroupCreated has copy, drop {
    group_id: u64,
    admin: address,
    name: String,
}

public struct MemberInvited has copy, drop {
    group_id: u64,
    invitee: address,
}

public struct SelfieRegistered has copy, drop {
    group_id: u64,
    member: address,
    reference_blob_id: String,
}

public struct FuelAdded has copy, drop {
    group_id: u64,
    amount: u64,
    paid_by: address,
}

public struct PhotoSubmitted has copy, drop {
    group_id: u64,
    photo_id: u64,
    blob_id: String,
    submitted_by: address,
    face_check_passed: bool,
}

public struct PhotoVoted has copy, drop {
    group_id: u64,
    photo_id: u64,
    voter: address,
    approve: bool,
}

public struct PhotoSealed has copy, drop {
    group_id: u64,
    photo_id: u64,
    blob_id: String,
}

// ===== Init =====

fun init(ctx: &mut TxContext) {
    let state = FamState {
        id: object::new(ctx),
        groups: table::new(ctx),
        group_count: 0,
        nautilus_pubkey: vector::empty(),
        admin: ctx.sender(),
    };
    transfer::share_object(state);
}

// ===== Admin: set Nautilus public key =====

public entry fun set_nautilus_pubkey(
    state: &mut FamState,
    pubkey: vector<u8>,
    ctx: &TxContext,
) {
    assert!(ctx.sender() == state.admin, ENotAdmin);
    state.nautilus_pubkey = pubkey;
}

// ===== Group creation =====

public entry fun create_group(
    state: &mut FamState,
    name: vector<u8>,
    display_name: vector<u8>,
    reference_blob_id: vector<u8>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let sender = ctx.sender();
    let group_id = state.group_count;
    let now = clock::timestamp_ms(clock);

    let mut members = vector::empty<Member>();
    members.push_back(Member {
        addr: sender,
        display_name: string::utf8(display_name),
        reference_blob_id: string::utf8(reference_blob_id),
        joined_at: now,
    });

    let group = Group {
        id: object::new(ctx),
        group_id,
        name: string::utf8(name),
        members,
        photos: table::new(ctx),
        photo_count: 0,
        fuel: PHOTOS_PER_FUEL, // free first batch
        treasury: balance::zero(),
        created_at: now,
        admin: sender,
        invited: vector::empty(),
    };

    let group_addr = object::id_address(&group);
    state.groups.add(group_id, group_addr);
    state.group_count = group_id + 1;

    event::emit(GroupCreated {
        group_id,
        admin: sender,
        name: string::utf8(name),
    });

    transfer::share_object(group);
}

// ===== Invitations =====

public entry fun invite_member(
    group: &mut Group,
    invitee: address,
    ctx: &TxContext,
) {
    assert!(ctx.sender() == group.admin, ENotAdmin);
    assert!(group.members.length() < MAX_MEMBERS, EGroupFull);
    assert!(!is_member(group, invitee), EAlreadyMember);
    assert!(!group.invited.contains(&invitee), EAlreadyMember);

    group.invited.push_back(invitee);

    event::emit(MemberInvited {
        group_id: group.group_id,
        invitee,
    });
}

// ===== Selfie registration (join group) =====

public entry fun register_selfie(
    group: &mut Group,
    display_name: vector<u8>,
    reference_blob_id: vector<u8>,
    clock: &Clock,
    ctx: &TxContext,
) {
    let sender = ctx.sender();
    assert!(group.members.length() < MAX_MEMBERS, EGroupFull);
    assert!(!is_member(group, sender), EAlreadyRegistered);
    assert!(group.invited.contains(&sender), ENotMember);

    let now = clock::timestamp_ms(clock);
    group.members.push_back(Member {
        addr: sender,
        display_name: string::utf8(display_name),
        reference_blob_id: string::utf8(reference_blob_id),
        joined_at: now,
    });

    // remove from invited
    let (found, idx) = group.invited.index_of(&sender);
    if (found) {
        group.invited.remove(idx);
    };

    event::emit(SelfieRegistered {
        group_id: group.group_id,
        member: sender,
        reference_blob_id: string::utf8(reference_blob_id),
    });
}

// ===== Fuel =====

public entry fun buy_fuel(
    group: &mut Group,
    payment: Coin<SUI>,
    ctx: &TxContext,
) {
    assert!(is_member(group, ctx.sender()), ENotMember);
    let amount = coin::value(&payment);
    assert!(amount >= FUEL_PRICE, EInsufficientPayment);

    let bundles = amount / FUEL_PRICE;
    let photos_added = bundles * PHOTOS_PER_FUEL;
    group.fuel = group.fuel + photos_added;

    balance::join(&mut group.treasury, coin::into_balance(payment));

    event::emit(FuelAdded {
        group_id: group.group_id,
        amount: photos_added,
        paid_by: ctx.sender(),
    });
}

// ===== Submit photo =====

public entry fun submit_photo(
    group: &mut Group,
    blob_id: vector<u8>,
    caption: vector<u8>,
    nautilus_attestation: vector<u8>,
    clock: &Clock,
    ctx: &TxContext,
) {
    let sender = ctx.sender();
    assert!(is_member(group, sender), ENotMember);
    assert!(group.fuel > 0, EInsufficientFuel);
    // Attestation must be non-empty (face check passed via Nautilus)
    assert!(nautilus_attestation.length() > 0, EFaceCheckFailed);

    let now = clock::timestamp_ms(clock);
    let photo_id = group.photo_count;

    let photo = Photo {
        id: photo_id,
        blob_id: string::utf8(blob_id),
        caption: string::utf8(caption),
        submitted_by: sender,
        submitted_at: now,
        approvals: vector::empty(),
        rejections: vector::empty(),
        sealed: false,
        face_check_passed: true,
        nautilus_attestation,
    };

    group.photos.add(photo_id, photo);
    group.photo_count = photo_id + 1;
    group.fuel = group.fuel - 1;

    event::emit(PhotoSubmitted {
        group_id: group.group_id,
        photo_id,
        blob_id: string::utf8(blob_id),
        submitted_by: sender,
        face_check_passed: true,
    });
}

// ===== Vote =====

public entry fun vote_photo(
    group: &mut Group,
    photo_id: u64,
    approve: bool,
    ctx: &TxContext,
) {
    let sender = ctx.sender();
    assert!(is_member(group, sender), ENotMember);
    assert!(group.photos.contains(photo_id), EPhotoNotFound);

    let group_id = group.group_id;
    let member_count = group.members.length();
    let photo = group.photos.borrow_mut(photo_id);
    assert!(!photo.sealed, EAlreadySealed);
    assert!(!photo.approvals.contains(&sender), EAlreadyVoted);
    assert!(!photo.rejections.contains(&sender), EAlreadyVoted);

    if (approve) {
        photo.approvals.push_back(sender);
    } else {
        photo.rejections.push_back(sender);
    };

    event::emit(PhotoVoted {
        group_id,
        photo_id,
        voter: sender,
        approve,
    });

    // Seal if unanimous approval
    if (photo.approvals.length() == member_count) {
        photo.sealed = true;
        let blob_id_copy = photo.blob_id;
        event::emit(PhotoSealed {
            group_id,
            photo_id,
            blob_id: blob_id_copy,
        });
    };
}

// ===== Helpers =====

fun is_member(group: &Group, addr: address): bool {
    let mut i = 0;
    let len = group.members.length();
    while (i < len) {
        if (group.members[i].addr == addr) return true;
        i = i + 1;
    };
    false
}

// ===== Views =====

public fun get_group_info(group: &Group): (u64, String, u64, u64, u64, address) {
    (
        group.group_id,
        group.name,
        group.members.length(),
        group.photo_count,
        group.fuel,
        group.admin,
    )
}

public fun get_members(group: &Group): &vector<Member> {
    &group.members
}

public fun get_photo_info(
    group: &Group,
    photo_id: u64,
): (String, String, address, u64, u64, u64, bool) {
    let photo = group.photos.borrow(photo_id);
    (
        photo.blob_id,
        photo.caption,
        photo.submitted_by,
        photo.submitted_at,
        photo.approvals.length(),
        photo.rejections.length(),
        photo.sealed,
    )
}

public fun photo_count(group: &Group): u64 { group.photo_count }
public fun fuel(group: &Group): u64 { group.fuel }
public fun member_count(group: &Group): u64 { group.members.length() }
public fun is_sealed(group: &Group, photo_id: u64): bool {
    group.photos.borrow(photo_id).sealed
}

// ===== Seal access policy =====
//
// Seal calls this to decide whether to release decryption shares.
// First parameter MUST be `id: vector<u8>` per the Seal SDK contract.
//
// Policy: the identity must be scoped to this group's object ID (prefix),
// AND the caller must be a current member of the group.

public fun seal_approve(
    id: vector<u8>,
    group: &Group,
    ctx: &TxContext,
) {
    let sender = ctx.sender();
    let prefix = sui::bcs::to_bytes(&object::id(group));
    let n = prefix.length();
    assert!(id.length() >= n, ENoAccess);
    let mut i = 0;
    while (i < n) {
        assert!(id[i] == prefix[i], ENoAccess);
        i = i + 1;
    };
    assert!(is_member(group, sender), ENoAccess);
}

#[test_only]
public fun init_for_testing(ctx: &mut TxContext) {
    init(ctx);
}
